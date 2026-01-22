import { EventEmitter as NodeEventEmitter } from 'events'
import {
  type Run,
  type RunState,
  type RunContract,
  type Phase,
  type Event,
  type CheckpointRequestedPayload,
  type ArtifactType,
  type ArtifactStatus,
  isTerminalState,
} from '../types'
import { type EventEmitter, type EmitResult } from './events'
import { type RunStateMachine, type TransitionResult, StateMachineError } from './run-state-machine'
import { type ApprovalService, type ApprovalResult, type RequestApprovalOptions } from './approvals'
import { type ErrorHandler, type ErrorInput, type HandleErrorResult, type PartialResultsInput } from './error-handler'
import { type RunDB, type CreateRunInput, type UpdateRunStateInput } from './run-db'
import { type SandboxAdapter, type ExtractedArtifact } from './sandbox-adapter'
import { type VaultWriter, type WriteResult, type WriteArtifactOptions } from './vault-writer'
import { type TraceWriter, type WriteTraceResult, type WriteTraceOptions } from './trace-writer'
import { type ContractValidator, type ValidationResult, type DriftResult, type ToolCall, type ConstraintContext } from './contract-validator'
import { type CostTracker, type BudgetStatus, type AddCostResult, type CostType } from './cost-tracker'

/**
 * Orchestrator state for internal tracking
 */
export type OrchestratorState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'stopping'
  | 'stopped'
  | 'error'

/**
 * Options for starting a run
 */
export interface StartRunOptions {
  /** Workspace ID for the run */
  workspace_id: string
  /** Template ID to use */
  template_id: string
  /** Template version */
  template_version: string
  /** Contract defining the run */
  contract: RunContract
  /** Optional custom sandbox template */
  sandbox_template_id?: string
  /** Optional timeout override in ms */
  timeout_ms?: number
}

/**
 * Options for performing a user action
 */
export interface UserActionOptions {
  /** Run ID to act on */
  run_id: string
  /** Actor performing the action */
  actor_id?: string
  /** Reason for the action (for audit) */
  reason?: string
}

/**
 * Result of orchestrator operations
 */
export interface OrchestratorResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  'run.created': { run: Run }
  'run.started': { run: Run }
  'run.completed': { run: Run; artifacts: ExtractedArtifact[] }
  'run.failed': { run: Run; error: string }
  'run.cancelled': { run: Run }
  'state.changed': { run_id: string; from: RunState; to: RunState }
  'checkpoint.requested': { run_id: string; checkpoint_id: string }
  'checkpoint.resolved': { run_id: string; checkpoint_id: string; approved: boolean }
  'sandbox.ready': { run_id: string; sandbox_id: string }
  'sandbox.error': { run_id: string; error: string }
  error: { run_id: string; error: string }
}

/**
 * Dependencies for the RunOrchestrator
 */
export interface OrchestratorDependencies {
  eventEmitter: EventEmitter
  stateMachine: RunStateMachine
  approvalService: ApprovalService
  errorHandler: ErrorHandler
  runDB: RunDB
  vaultWriter: VaultWriter
  traceWriter: TraceWriter
  contractValidator: ContractValidator
  costTracker: CostTracker
  /** Factory for creating sandbox adapters */
  createSandbox: (options: { run_id: string; contract: RunContract; template_id?: string; timeout_ms?: number }) => SandboxAdapter
}

/**
 * RunOrchestrator - the central control plane for run execution
 *
 * Responsibilities:
 * - Create and manage run lifecycle
 * - Coordinate sandbox creation and destruction
 * - Drive state machine transitions
 * - Handle user actions (pause, resume, cancel)
 * - Gate execution on approval requests
 * - Collect and persist artifacts
 * - Emit events for real-time UI updates
 * - Handle errors and recovery
 *
 * Design principles:
 * - Single run per orchestrator instance
 * - All state changes go through state machine
 * - All events go through event emitter
 * - Errors are handled via error handler
 * - Approvals block execution until resolved
 */
export class RunOrchestrator extends NodeEventEmitter {
  private _state: OrchestratorState = 'idle'
  private run: Run | null = null
  private sandbox: SandboxAdapter | null = null
  private collectedEvents: Event[] = []
  private extractedArtifacts: ExtractedArtifact[] = []
  private phaseStartTime: number = 0
  private currentCheckpointId: string | null = null

  // Timeout management
  private approvalTimeoutInterval: NodeJS.Timeout | null = null

  constructor(private readonly deps: OrchestratorDependencies) {
    super()
  }

  /**
   * Get current orchestrator state
   */
  get state(): OrchestratorState {
    return this._state
  }

  /**
   * Get the current run (if any)
   */
  get currentRun(): Run | null {
    return this.run
  }

  /**
   * Start a new run
   *
   * Creates the run in the database, provisions a sandbox,
   * and begins execution.
   */
  async start(options: StartRunOptions): Promise<OrchestratorResult<Run>> {
    if (this._state !== 'idle') {
      return { success: false, error: `Cannot start run in state: ${this._state}` }
    }

    this._state = 'starting'

    try {
      // Validate the contract first
      const validationResult = this.deps.contractValidator.validatePreRun(options.contract)
      if (!validationResult.valid) {
        const errors = validationResult.issues.filter((i: { severity: string }) => i.severity === 'error')
        if (errors.length > 0) {
          this._state = 'idle'
          return {
            success: false,
            error: `Contract validation failed: ${errors.map((e: { message: string }) => e.message).join(', ')}`
          }
        }
      }

      // Create run in database
      const createInput: CreateRunInput = {
        workspace_id: options.workspace_id,
        template_id: options.template_id,
        template_version: options.template_version,
        contract: options.contract,
      }

      const createResult = await this.deps.runDB.createRun(createInput)
      if (!createResult.success) {
        this._state = 'idle'
        return { success: false, error: createResult.error }
      }

      this.run = createResult.data
      this.emit('run.created', { run: this.run })

      // Transition to initializing
      const transitionResult = this.transitionState('initializing', 'Starting run')
      if (!transitionResult.success) {
        await this.handleStartupError(transitionResult.error!)
        return { success: false, error: transitionResult.error }
      }

      // Create and start sandbox
      const sandboxResult = await this.initializeSandbox(options)
      if (!sandboxResult.success) {
        await this.handleStartupError(sandboxResult.error!)
        return { success: false, error: sandboxResult.error }
      }

      // Mark run as started
      await this.deps.runDB.markRunStarted(this.run.run_id)

      // Emit run.started event
      this.emitRunEvent('run.started', {
        contract_id: this.run.run_id,
        template_id: options.template_id,
        template_version: options.template_version,
        goal: options.contract.goal,
      })

      // Transition to planning phase
      const planningResult = this.transitionState('planning', 'Sandbox ready, beginning planning')
      if (!planningResult.success) {
        await this.handleStartupError(planningResult.error!)
        return { success: false, error: planningResult.error }
      }

      this._state = 'running'
      this.phaseStartTime = Date.now()
      this.emit('run.started', { run: this.run })

      // Start approval timeout checker
      this.startApprovalTimeoutChecker()

      return { success: true, data: this.run }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.handleStartupError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Pause the current run
   */
  async pause(options: UserActionOptions): Promise<OrchestratorResult<Run>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    if (this._state !== 'running') {
      return { success: false, error: `Cannot pause run in state: ${this._state}` }
    }

    try {
      // Perform pause action via state machine
      const actionResult = this.deps.stateMachine.performAction(this.run, { action: 'pause' })

      // Update run in database
      await this.updateRunState({
        state: actionResult.newState,
        previous_state: actionResult.previousState,
      })

      this._state = 'paused'
      this.emit('state.changed', { run_id: this.run.run_id, from: this.run.state, to: actionResult.newState })

      return { success: true, data: this.run }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Resume a paused run
   */
  async resume(options: UserActionOptions): Promise<OrchestratorResult<Run>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    if (this._state !== 'paused') {
      return { success: false, error: `Cannot resume run in state: ${this._state}` }
    }

    try {
      // Perform resume action via state machine
      const actionResult = this.deps.stateMachine.performAction(this.run, { action: 'resume' })

      // Update run in database
      await this.updateRunState({
        state: actionResult.newState,
        previous_state: actionResult.previousState,
      })

      this._state = 'running'
      this.phaseStartTime = Date.now()
      this.emit('state.changed', { run_id: this.run.run_id, from: 'paused', to: actionResult.newState })

      return { success: true, data: this.run }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Cancel the current run
   */
  async cancel(options: UserActionOptions): Promise<OrchestratorResult<Run>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    if (isTerminalState(this.run.state)) {
      return { success: false, error: `Run is already in terminal state: ${this.run.state}` }
    }

    try {
      this._state = 'stopping'

      // Perform cancel action via state machine
      const actionResult = this.deps.stateMachine.performAction(this.run, { action: 'cancel' })

      // Cleanup sandbox
      await this.cleanupSandbox()

      // Update run in database
      await this.updateRunState({
        state: actionResult.newState,
        previous_state: null,
      })

      this._state = 'stopped'
      this.emit('run.cancelled', { run: this.run })

      // Write trace
      await this.writeTrace('cancelled', 'Run cancelled by user')

      return { success: true, data: this.run }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this._state = 'error'
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Request approval for an action (checkpoint)
   *
   * Pauses execution until approval is granted or rejected.
   */
  async requestApproval(
    payload: CheckpointRequestedPayload,
    options?: RequestApprovalOptions,
  ): Promise<OrchestratorResult<ApprovalResult>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    if (this._state !== 'running') {
      return { success: false, error: `Cannot request approval in state: ${this._state}` }
    }

    try {
      // Emit checkpoint.requested event
      this.emitRunEvent('checkpoint.requested', payload)

      // Request approval via approval service
      const approvalResult = this.deps.approvalService.requestApproval(
        this.run,
        payload,
        options ?? { timeout_seconds: payload.timeout_seconds },
      )

      if (!approvalResult.success) {
        return { success: false, error: approvalResult.error }
      }

      // Update orchestrator state
      this._state = 'awaiting_approval'
      this.currentCheckpointId = payload.checkpoint_id

      // Update run state in database (approval service already updated state machine)
      await this.updateRunState({
        state: approvalResult.transition!.newState,
        previous_state: approvalResult.transition!.previousState,
      })

      this.emit('checkpoint.requested', { run_id: this.run.run_id, checkpoint_id: payload.checkpoint_id })

      return { success: true, data: approvalResult }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Handle checkpoint approval
   *
   * Called by approval service when approval is granted.
   */
  async onApprovalGranted(checkpointId: string): Promise<void> {
    if (!this.run || this.currentCheckpointId !== checkpointId) {
      return
    }

    this._state = 'running'
    this.currentCheckpointId = null
    this.phaseStartTime = Date.now()

    this.emit('checkpoint.resolved', { run_id: this.run.run_id, checkpoint_id: checkpointId, approved: true })
  }

  /**
   * Handle checkpoint rejection
   *
   * Called by approval service when approval is rejected.
   */
  async onApprovalRejected(checkpointId: string, newState: RunState): Promise<void> {
    if (!this.run || this.currentCheckpointId !== checkpointId) {
      return
    }

    this.currentCheckpointId = null

    // Update orchestrator state based on new run state
    if (newState === 'cancelled') {
      this._state = 'stopped'
      await this.cleanupSandbox()
      this.emit('run.cancelled', { run: this.run })
    } else if (newState === 'paused') {
      this._state = 'paused'
    } else if (newState === 'failed') {
      this._state = 'error'
      await this.cleanupSandbox()
      this.emit('run.failed', { run: this.run, error: 'Approval rejected' })
    }

    this.emit('checkpoint.resolved', { run_id: this.run.run_id, checkpoint_id: checkpointId, approved: false })
  }

  /**
   * Transition to the next phase
   *
   * Called when the current phase completes successfully.
   */
  async advancePhase(reason?: string): Promise<OrchestratorResult<RunState>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    if (this._state !== 'running') {
      return { success: false, error: `Cannot advance phase in state: ${this._state}` }
    }

    const currentState = this.run.state
    let nextState: RunState

    // Determine next state based on current
    switch (currentState) {
      case 'planning':
        nextState = 'executing'
        break
      case 'executing':
        nextState = 'verifying'
        break
      case 'verifying':
        nextState = 'packaging'
        break
      case 'packaging':
        nextState = 'completed'
        break
      default:
        return { success: false, error: `Cannot advance from state: ${currentState}` }
    }

    // Transition
    const transitionResult = this.transitionState(nextState, reason)
    if (!transitionResult.success) {
      return { success: false, error: transitionResult.error }
    }

    this.phaseStartTime = Date.now()

    // Handle terminal state
    if (nextState === 'completed') {
      await this.handleCompletion()
    }

    return { success: true, data: nextState }
  }

  /**
   * Handle an error during execution
   */
  async handleError(error: ErrorInput, partialResults?: PartialResultsInput): Promise<HandleErrorResult> {
    if (!this.run) {
      throw new Error('No run in progress')
    }

    // Delegate to error handler
    const result = this.deps.errorHandler.handleError(this.run, error, partialResults)

    if (result.shouldRetry) {
      // Schedule retry
      setTimeout(() => {
        // Retry logic would go here - emit event for external handler
        this.emit('error', { run_id: this.run!.run_id, error: `Retrying after: ${error.message}` })
      }, result.retryDelayMs)
    } else if (result.newState) {
      // Update run state
      await this.updateRunState({
        state: result.newState,
        error: {
          type: result.errorDetails.category,
          message: result.errorDetails.user_message,
          recoverable: result.errorDetails.recoverable,
        },
      })

      this._state = 'error'
      await this.cleanupSandbox()
      this.emit('run.failed', { run: this.run, error: result.errorDetails.user_message })

      // Write trace
      await this.writeTrace('failed', result.errorDetails.user_message)
    }

    return result
  }

  /**
   * Record a tool call result
   */
  recordToolCall(
    toolName: string,
    input: Record<string, unknown>,
    success: boolean,
    output?: string,
    durationMs?: number,
    error?: string,
  ): void {
    if (!this.run) return

    // Emit tool.called event
    this.emitRunEvent('tool.called', {
      tool_name: toolName,
      tool_input: input,
    })

    // Emit tool.result event
    this.emitRunEvent('tool.result', {
      tool_name: toolName,
      success,
      output_summary: output,
      error,
      duration_ms: durationMs ?? 0,
    })
  }

  /**
   * Validate a tool call against contract constraints
   */
  validateToolCall(toolCall: ToolCall): ValidationResult {
    if (!this.run) {
      return { valid: false, issues: [{ type: 'constraint_violation', severity: 'error', message: 'No run in progress' }] }
    }

    return this.deps.contractValidator.validateToolCall(this.run.contract, toolCall)
  }

  /**
   * Validate constraints for an action
   */
  validateConstraints(context: ConstraintContext): ValidationResult {
    if (!this.run) {
      return { valid: false, issues: [{ type: 'constraint_violation', severity: 'error', message: 'No run in progress' }] }
    }

    return this.deps.contractValidator.validateConstraints(this.run.contract, context)
  }

  /**
   * Add artifact to the run
   */
  async addArtifact(artifact: ExtractedArtifact, artifactOptions: {
    title: string;
    type: ArtifactType;
    status: ArtifactStatus;
    description?: string;
  }): Promise<OrchestratorResult<WriteResult>> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    // Write to vault
    const writeOptions: WriteArtifactOptions = {
      run_id: this.run.run_id,
      agent: this.run.template_id,
      source: this.run.contract.goal,
      title: artifactOptions.title,
      type: artifactOptions.type,
      status: artifactOptions.status,
      description: artifactOptions.description,
    }

    const writeResult = await this.deps.vaultWriter.writeArtifact(
      artifact.content.toString('utf8'),
      writeOptions,
    )

    if (writeResult.success && writeResult.manifest) {
      // Store in extracted artifacts
      this.extractedArtifacts.push(artifact)

      // Add to run in database
      await this.deps.runDB.addArtifact(this.run.run_id, {
        artifact_id: writeResult.manifest.artifact_id,
        type: writeResult.manifest.type,
        path: writeResult.manifest.destination_path,
      })

      // Emit artifact.created event
      this.emitRunEvent('artifact.created', {
        artifact_id: writeResult.manifest.artifact_id,
        type: writeResult.manifest.type,
        destination_path: writeResult.manifest.destination_path,
        preview_type: writeResult.manifest.preview_type,
      })
    }

    return { success: writeResult.success, data: writeResult, error: writeResult.error }
  }

  /**
   * Get cost breakdown for the run
   */
  getCostBreakdown(): { compute_cents: number; api_cents: number; total_cents: number } | null {
    if (!this.run) return null
    return this.deps.costTracker.getCostBreakdown(this.run.run_id)
  }

  /**
   * Add cost to tracking
   */
  addCost(
    costType: CostType,
    amountCents: number,
    description: string,
    metadata?: Record<string, unknown>
  ): AddCostResult {
    if (!this.run) {
      return { success: false }
    }
    return this.deps.costTracker.addCost(
      this.run.run_id,
      this.run.workspace_id,
      costType,
      amountCents,
      description,
      metadata
    )
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.stopApprovalTimeoutChecker()
    await this.cleanupSandbox()
    this._state = 'stopped'
  }

  // ─────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────

  private async initializeSandbox(options: StartRunOptions): Promise<OrchestratorResult<void>> {
    try {
      this.sandbox = this.deps.createSandbox({
        run_id: this.run!.run_id,
        contract: options.contract,
        template_id: options.sandbox_template_id,
        timeout_ms: options.timeout_ms,
      })

      // Set up sandbox event handlers
      this.sandbox.on('timeout', () => {
        this.handleError({
          type: 'timeout',
          message: 'Sandbox execution timed out',
          category: 'timeout',
        })
      })

      this.sandbox.on('output', (_output) => {
        // Could emit as event for real-time streaming
      })

      // Start sandbox
      await this.sandbox.start()

      // Update run with execution env
      await this.deps.runDB.updateExecutionEnv(this.run!.run_id, {
        sandbox_id: this.sandbox.sandboxId!,
        template_id: options.sandbox_template_id ?? 'base',
        created_at: new Date().toISOString(),
      })

      this.emit('sandbox.ready', { run_id: this.run!.run_id, sandbox_id: this.sandbox.sandboxId! })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('sandbox.error', { run_id: this.run!.run_id, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  private async cleanupSandbox(): Promise<void> {
    if (this.sandbox) {
      // Extract any remaining artifacts before shutdown
      if (this.sandbox.state === 'ready' || this.sandbox.state === 'running') {
        try {
          const outputDir = '/home/user/workspace/outputs'
          const files = await this.sandbox.listFiles(outputDir)
          if (files.length > 0) {
            const artifacts = await this.sandbox.extractArtifacts(files)
            this.extractedArtifacts.push(...artifacts)
          }
        } catch {
          // Ignore extraction errors during cleanup
        }
      }

      await this.sandbox.shutdown()
      this.sandbox = null
    }
  }

  private transitionState(targetState: RunState, reason?: string): OrchestratorResult<TransitionResult> {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    try {
      const result = this.deps.stateMachine.transition(this.run, { targetState, reason })

      // Update local run state
      const previousState = this.run.state
      this.run.state = result.newState
      this.run.previous_state = result.previousState

      this.emit('state.changed', { run_id: this.run.run_id, from: previousState, to: result.newState })

      return { success: true, data: result }
    } catch (error) {
      if (error instanceof StateMachineError) {
        return { success: false, error: error.message }
      }
      return { success: false, error: String(error) }
    }
  }

  private async updateRunState(input: UpdateRunStateInput): Promise<void> {
    if (!this.run) return

    const result = await this.deps.runDB.updateRunState(this.run.run_id, input)
    if (result.success) {
      this.run = result.data
    }
  }

  private async handleStartupError(error: string): Promise<void> {
    this._state = 'error'

    if (this.run) {
      // Transition to failed
      try {
        this.deps.stateMachine.transition(this.run, { targetState: 'failed', reason: error })
      } catch {
        // Ignore - may already be in invalid state
      }

      await this.deps.runDB.updateRunState(this.run.run_id, {
        state: 'failed',
        error: { type: 'startup_error', message: error, recoverable: false },
      })

      this.emit('run.failed', { run: this.run, error })
    }

    await this.cleanupSandbox()
  }

  private async handleCompletion(): Promise<void> {
    if (!this.run) return

    this._state = 'stopping'

    // Extract final artifacts
    await this.cleanupSandbox()

    // Mark run as completed
    const costBreakdown = this.deps.costTracker.getCostBreakdown(this.run.run_id)
    await this.deps.runDB.markRunCompleted(this.run.run_id, {
      compute_cents: costBreakdown?.compute_cents ?? 0,
      api_cents: costBreakdown?.api_cents ?? 0,
    })

    // Emit run.completed event
    this.emitRunEvent('run.completed', {
      outcome_summary: 'Run completed successfully',
      artifacts_produced: this.extractedArtifacts.length,
      duration_seconds: Math.round((Date.now() - new Date(this.run.timestamps.created_at).getTime()) / 1000),
      cost_cents: costBreakdown?.total_cents,
    })

    // Write trace
    await this.writeTrace('completed', 'Run completed successfully')

    this._state = 'stopped'
    this.emit('run.completed', { run: this.run, artifacts: this.extractedArtifacts })
  }

  private async writeTrace(outcome: 'completed' | 'failed' | 'cancelled', notes?: string): Promise<void> {
    if (!this.run) return

    try {
      const traceOptions: WriteTraceOptions = {
        run: this.run,
        events: this.collectedEvents,
        outcome_summary: notes,
      }
      await this.deps.traceWriter.writeTrace(traceOptions)
    } catch {
      // Trace writing failure should not affect run outcome
    }
  }

  private emitRunEvent<T extends keyof import('../types').EventPayloadMap>(
    type: T,
    payload: import('../types').EventPayloadMap[T],
  ): EmitResult {
    if (!this.run) {
      return { success: false, error: 'No run in progress' }
    }

    const result = this.deps.eventEmitter.emit(
      this.run.run_id,
      type,
      payload,
      this.run.state as Phase,
      'info',
    )

    // Collect event for trace
    if (result.success && result.event) {
      this.collectedEvents.push(result.event)
    }

    return result
  }

  private startApprovalTimeoutChecker(): void {
    // Check for approval timeouts every 5 seconds
    this.approvalTimeoutInterval = setInterval(() => {
      const results = this.deps.approvalService.processTimeouts()
      for (const result of results) {
        if (result.status === 'timeout') {
          // Handle timeout based on transition result
          if (result.transition?.newState) {
            this.onApprovalRejected(result.checkpoint_id, result.transition.newState)
          }
        }
      }
    }, 5000)
  }

  private stopApprovalTimeoutChecker(): void {
    if (this.approvalTimeoutInterval) {
      clearInterval(this.approvalTimeoutInterval)
      this.approvalTimeoutInterval = null
    }
  }
}

/**
 * Factory function for creating RunOrchestrator instances
 */
export function createRunOrchestrator(deps: OrchestratorDependencies): RunOrchestrator {
  return new RunOrchestrator(deps)
}
