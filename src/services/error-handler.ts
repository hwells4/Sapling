import { z } from 'zod'
import { type Run, type RunState, isTerminalState } from '../types/run'
import { type Phase } from '../types'
import { type EventEmitter } from './events'
import { type RunStateMachine, type TransitionResult } from './run-state-machine'

/**
 * Error categories for classification
 *
 * | Category          | Description                                  | Auto-Retry | Recoverable |
 * |-------------------|----------------------------------------------|------------|-------------|
 * | transient         | Temporary failures (network, rate limit)     | Yes        | Yes         |
 * | tool_failure      | Tool execution failed                        | Sometimes  | Usually     |
 * | agent_error       | Agent produced invalid output                | No         | Sometimes   |
 * | sandbox_crash     | Sandbox process died unexpectedly            | Yes (once) | Usually     |
 * | contract_violation| Agent violated contract constraints          | No         | No          |
 * | timeout           | Operation exceeded time limit                | No         | Sometimes   |
 * | approval_timeout  | Approval request timed out                   | No         | Yes         |
 * | stalled           | No progress detected for extended period     | No         | Sometimes   |
 */
export const ErrorCategory = z.enum([
  'transient',
  'tool_failure',
  'agent_error',
  'sandbox_crash',
  'contract_violation',
  'timeout',
  'approval_timeout',
  'stalled',
])
export type ErrorCategory = z.infer<typeof ErrorCategory>

/**
 * Detailed error information
 */
export const ErrorDetailsSchema = z.object({
  /** Unique error ID for tracking */
  error_id: z.string(),
  /** Error category for handling logic */
  category: ErrorCategory,
  /** Original error type/code from source */
  original_type: z.string(),
  /** Raw error message from source */
  original_message: z.string(),
  /** Human-readable error message */
  user_message: z.string(),
  /** Whether the error is recoverable (can retry) */
  recoverable: z.boolean(),
  /** Number of retry attempts made */
  retry_count: z.number().int().nonnegative(),
  /** Maximum retries allowed for this error */
  max_retries: z.number().int().nonnegative(),
  /** Timestamp of the error */
  occurred_at: z.string().datetime(),
  /** Run state when error occurred */
  state_at_error: z.string(),
  /** Additional context for debugging */
  context: z.record(z.unknown()).optional(),
})
export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>

/**
 * Partial results that can be preserved on failure
 */
export const PartialResultsSchema = z.object({
  /** Run ID these results belong to */
  run_id: z.string(),
  /** Phase where work stopped */
  last_phase: z.string(),
  /** Artifacts produced before failure */
  artifacts: z.array(
    z.object({
      artifact_id: z.string(),
      type: z.string(),
      path: z.string(),
    }),
  ),
  /** Files modified before failure */
  files_changed: z.array(
    z.object({
      path: z.string(),
      operation: z.enum(['created', 'modified', 'deleted']),
    }),
  ),
  /** Last successful event seq */
  last_event_seq: z.number().int().nonnegative(),
  /** Timestamp when partial results were captured */
  captured_at: z.string().datetime(),
})
export type PartialResults = z.infer<typeof PartialResultsSchema>

/**
 * Retry configuration per error category
 */
interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number
  /** Base delay in milliseconds */
  baseDelayMs: number
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean
  /** Maximum delay in milliseconds (cap for exponential) */
  maxDelayMs: number
}

/**
 * Default retry configurations per category
 */
const DEFAULT_RETRY_CONFIGS: Record<ErrorCategory, RetryConfig> = {
  transient: { maxRetries: 3, baseDelayMs: 2000, exponentialBackoff: true, maxDelayMs: 16000 },
  tool_failure: { maxRetries: 2, baseDelayMs: 1000, exponentialBackoff: true, maxDelayMs: 4000 },
  agent_error: { maxRetries: 0, baseDelayMs: 0, exponentialBackoff: false, maxDelayMs: 0 },
  sandbox_crash: { maxRetries: 1, baseDelayMs: 5000, exponentialBackoff: false, maxDelayMs: 5000 },
  contract_violation: { maxRetries: 0, baseDelayMs: 0, exponentialBackoff: false, maxDelayMs: 0 },
  timeout: { maxRetries: 0, baseDelayMs: 0, exponentialBackoff: false, maxDelayMs: 0 },
  approval_timeout: { maxRetries: 0, baseDelayMs: 0, exponentialBackoff: false, maxDelayMs: 0 },
  stalled: { maxRetries: 0, baseDelayMs: 0, exponentialBackoff: false, maxDelayMs: 0 },
}

/**
 * Human-readable error messages per category
 */
const USER_MESSAGES: Record<ErrorCategory, string> = {
  transient: 'A temporary error occurred. The system is automatically retrying.',
  tool_failure: 'A tool failed to execute properly. Please check the logs for details.',
  agent_error: 'The agent produced an invalid response. The run has been stopped.',
  sandbox_crash: 'The execution environment crashed unexpectedly. Attempting recovery.',
  contract_violation: 'The agent violated a safety constraint. The run has been stopped for review.',
  timeout: 'The operation took too long and was stopped.',
  approval_timeout: 'The approval request timed out. Please retry if you still want to proceed.',
  stalled: 'The run appears to be stuck with no progress. Please review the logs.',
}

/**
 * Detailed user message templates with context interpolation
 */
const DETAILED_USER_MESSAGES: Record<ErrorCategory, (context: Record<string, unknown>) => string> = {
  transient: (ctx) =>
    ctx.retry_count !== undefined
      ? `A temporary error occurred (attempt ${Number(ctx.retry_count) + 1}/${ctx.max_retries}). Retrying in ${ctx.delay_seconds}s...`
      : USER_MESSAGES.transient,
  tool_failure: (ctx) =>
    ctx.tool_name ? `Tool "${ctx.tool_name}" failed: ${ctx.error || 'unknown error'}` : USER_MESSAGES.tool_failure,
  agent_error: (ctx) =>
    ctx.details ? `Agent error: ${ctx.details}` : USER_MESSAGES.agent_error,
  sandbox_crash: (ctx) =>
    ctx.sandbox_id ? `Sandbox ${ctx.sandbox_id} crashed. ${ctx.recoverable ? 'Attempting recovery.' : 'Recovery not possible.'}` : USER_MESSAGES.sandbox_crash,
  contract_violation: (ctx) =>
    ctx.constraint ? `Contract violation: ${ctx.constraint}` : USER_MESSAGES.contract_violation,
  timeout: (ctx) =>
    ctx.duration_seconds
      ? `Operation timed out after ${ctx.duration_seconds} seconds.`
      : USER_MESSAGES.timeout,
  approval_timeout: (ctx) =>
    ctx.checkpoint_id
      ? `Approval for checkpoint ${ctx.checkpoint_id} timed out after ${ctx.timeout_seconds || 'the configured'} seconds.`
      : USER_MESSAGES.approval_timeout,
  stalled: (ctx) =>
    ctx.stalled_seconds
      ? `No progress detected for ${ctx.stalled_seconds} seconds.`
      : USER_MESSAGES.stalled,
}

/**
 * Result of handling an error
 */
export interface HandleErrorResult {
  /** Whether the error was handled (retry scheduled or failure recorded) */
  handled: boolean
  /** Should retry the operation */
  shouldRetry: boolean
  /** Delay before retry in milliseconds (if shouldRetry) */
  retryDelayMs: number
  /** Error details that were recorded */
  errorDetails: ErrorDetails
  /** Partial results captured (if any) */
  partialResults?: PartialResults
  /** New run state (if state machine transition occurred) */
  newState?: RunState
}

/**
 * Error input for classification
 */
export interface ErrorInput {
  /** Error type/code from source */
  type: string
  /** Error message */
  message: string
  /** Error category (if known) */
  category?: ErrorCategory
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Partial results input
 */
export interface PartialResultsInput {
  /** Artifacts produced */
  artifacts?: Array<{ artifact_id: string; type: string; path: string }>
  /** Files changed */
  files_changed?: Array<{ path: string; operation: 'created' | 'modified' | 'deleted' }>
}

/**
 * ErrorHandler - manages error classification, retry logic, and recovery
 *
 * This service handles all error processing for runs:
 * - Classifies errors into categories
 * - Manages retry logic with exponential backoff
 * - Generates user-friendly error messages
 * - Preserves partial results on failure
 * - Integrates with state machine for state transitions
 * - Emits run.failed events
 */
export class ErrorHandler {
  /** Track retry counts per run */
  private retryCounts: Map<string, Map<ErrorCategory, number>> = new Map()

  constructor(
    private readonly eventEmitter?: EventEmitter,
    private readonly stateMachine?: RunStateMachine,
    private readonly retryConfigs: Record<ErrorCategory, RetryConfig> = DEFAULT_RETRY_CONFIGS,
  ) {}

  /**
   * Handle an error for a run
   *
   * This method:
   * 1. Classifies the error
   * 2. Determines if retry is possible
   * 3. Captures partial results if provided
   * 4. Transitions state if needed
   * 5. Emits run.failed event if terminal
   */
  handleError(run: Run, error: ErrorInput, partialResultsInput?: PartialResultsInput): HandleErrorResult {
    const category = error.category ?? this.classifyError(error.type, error.message)
    const retryConfig = this.retryConfigs[category]

    // Get current retry count for this run/category
    const currentRetryCount = this.getRetryCount(run.run_id, category)
    const canRetry = currentRetryCount < retryConfig.maxRetries

    // Calculate retry delay with exponential backoff
    const retryDelayMs = canRetry ? this.calculateRetryDelay(currentRetryCount, retryConfig) : 0

    // Generate user message with context
    const context: Record<string, unknown> = {
      ...error.context,
      retry_count: currentRetryCount,
      max_retries: retryConfig.maxRetries,
      delay_seconds: Math.round(retryDelayMs / 1000),
      recoverable: canRetry,
    }
    const userMessage = DETAILED_USER_MESSAGES[category](context)

    // Create error details
    const errorDetails: ErrorDetails = {
      error_id: crypto.randomUUID(),
      category,
      original_type: error.type,
      original_message: error.message,
      user_message: userMessage,
      recoverable: canRetry,
      retry_count: currentRetryCount,
      max_retries: retryConfig.maxRetries,
      occurred_at: new Date().toISOString(),
      state_at_error: run.state,
      context: error.context,
    }

    // Capture partial results if provided
    let partialResults: PartialResults | undefined
    if (partialResultsInput) {
      partialResults = this.capturePartialResults(run, partialResultsInput)
    }

    // Handle retry or failure
    if (canRetry) {
      // Increment retry count
      this.incrementRetryCount(run.run_id, category)

      return {
        handled: true,
        shouldRetry: true,
        retryDelayMs,
        errorDetails,
        partialResults,
      }
    }

    // No more retries - transition to failed state
    let newState: RunState | undefined
    if (this.stateMachine && !isTerminalState(run.state)) {
      try {
        const result = this.stateMachine.transition(run, {
          targetState: 'failed',
          reason: `Error: ${category} - ${error.message}`,
        })
        newState = result.newState
      } catch {
        // State transition failed - still record the error
        newState = 'failed' // Assume failed for error details
      }
    }

    // Emit run.failed event
    this.emitRunFailed(run.run_id, run.state as Phase, errorDetails)

    return {
      handled: true,
      shouldRetry: false,
      retryDelayMs: 0,
      errorDetails,
      partialResults,
      newState,
    }
  }

  /**
   * Classify an error into a category based on type and message
   */
  classifyError(type: string, message: string): ErrorCategory {
    const lowerType = type.toLowerCase()
    const lowerMessage = message.toLowerCase()

    // Transient errors
    if (
      lowerType.includes('network') ||
      lowerType.includes('timeout') ||
      lowerType.includes('rate_limit') ||
      lowerType.includes('temporary') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('econnreset') ||
      lowerMessage.includes('etimedout') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('retry') ||
      lowerMessage.includes('503') ||
      lowerMessage.includes('502') ||
      lowerMessage.includes('429')
    ) {
      return 'transient'
    }

    // Sandbox crash
    if (
      lowerType.includes('sandbox') ||
      lowerType.includes('process') ||
      lowerMessage.includes('sandbox') ||
      lowerMessage.includes('crashed') ||
      lowerMessage.includes('killed') ||
      lowerMessage.includes('oom') ||
      lowerMessage.includes('out of memory')
    ) {
      return 'sandbox_crash'
    }

    // Contract violation
    if (
      lowerType.includes('contract') ||
      lowerType.includes('constraint') ||
      lowerType.includes('policy') ||
      lowerMessage.includes('contract') ||
      lowerMessage.includes('constraint') ||
      lowerMessage.includes('not allowed') ||
      lowerMessage.includes('blocked')
    ) {
      return 'contract_violation'
    }

    // Tool failure
    if (
      lowerType.includes('tool') ||
      lowerMessage.includes('tool') ||
      lowerMessage.includes('execution failed')
    ) {
      return 'tool_failure'
    }

    // Timeout
    if (lowerType === 'timeout' || lowerMessage.includes('timed out')) {
      return 'timeout'
    }

    // Approval timeout
    if (lowerType.includes('approval') || lowerMessage.includes('approval')) {
      return 'approval_timeout'
    }

    // Stalled
    if (lowerType.includes('stall') || lowerMessage.includes('stalled') || lowerMessage.includes('no progress')) {
      return 'stalled'
    }

    // Default to agent error for unclassified errors
    return 'agent_error'
  }

  /**
   * Get a user-friendly error message for a category
   */
  getUserMessage(category: ErrorCategory, context?: Record<string, unknown>): string {
    if (context) {
      return DETAILED_USER_MESSAGES[category](context)
    }
    return USER_MESSAGES[category]
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount: number, config: RetryConfig): number {
    if (!config.exponentialBackoff) {
      return config.baseDelayMs
    }

    // Exponential backoff: baseDelay * 2^retryCount
    const delay = config.baseDelayMs * Math.pow(2, retryCount)
    return Math.min(delay, config.maxDelayMs)
  }

  /**
   * Capture partial results from a failed run
   */
  capturePartialResults(run: Run, input: PartialResultsInput): PartialResults {
    return {
      run_id: run.run_id,
      last_phase: run.state,
      artifacts: input.artifacts ?? run.artifacts.map((a) => ({
        artifact_id: a.artifact_id,
        type: a.type,
        path: a.path,
      })),
      files_changed: input.files_changed ?? [],
      last_event_seq: run.last_event_seq,
      captured_at: new Date().toISOString(),
    }
  }

  /**
   * Check if an error category is recoverable
   */
  isRecoverable(category: ErrorCategory): boolean {
    return this.retryConfigs[category].maxRetries > 0
  }

  /**
   * Get retry configuration for a category
   */
  getRetryConfig(category: ErrorCategory): RetryConfig {
    return this.retryConfigs[category]
  }

  /**
   * Clear retry counts for a run (call on successful completion or new run)
   */
  clearRetryCount(runId: string): void {
    this.retryCounts.delete(runId)
  }

  /**
   * Get current retry count for a run/category
   */
  private getRetryCount(runId: string, category: ErrorCategory): number {
    return this.retryCounts.get(runId)?.get(category) ?? 0
  }

  /**
   * Increment retry count for a run/category
   */
  private incrementRetryCount(runId: string, category: ErrorCategory): void {
    if (!this.retryCounts.has(runId)) {
      this.retryCounts.set(runId, new Map())
    }
    const current = this.retryCounts.get(runId)!.get(category) ?? 0
    this.retryCounts.get(runId)!.set(category, current + 1)
  }

  /**
   * Emit run.failed event
   */
  private emitRunFailed(runId: string, phase: Phase, errorDetails: ErrorDetails): void {
    if (!this.eventEmitter) return

    this.eventEmitter.emit(runId, 'run.failed', {
      error_type: errorDetails.category,
      error_message: errorDetails.user_message,
      recoverable: errorDetails.recoverable,
      checkpoint_available: false, // TODO: Check for checkpoints
    }, phase, 'error')
  }
}

/**
 * Factory function for creating ErrorHandler instances
 */
export function createErrorHandler(
  eventEmitter?: EventEmitter,
  stateMachine?: RunStateMachine,
  retryConfigs?: Partial<Record<ErrorCategory, Partial<RetryConfig>>>,
): ErrorHandler {
  // Merge custom configs with defaults
  const mergedConfigs = { ...DEFAULT_RETRY_CONFIGS }
  if (retryConfigs) {
    for (const [category, config] of Object.entries(retryConfigs)) {
      mergedConfigs[category as ErrorCategory] = {
        ...DEFAULT_RETRY_CONFIGS[category as ErrorCategory],
        ...config,
      }
    }
  }

  return new ErrorHandler(eventEmitter, stateMachine, mergedConfigs)
}
