import { z } from 'zod'
import {
  type Event,
  type EventType,
  type Phase,
  type CheckpointRequestedPayload,
  type CheckpointApprovedPayload,
  type CheckpointRejectedPayload,
  type CheckpointTimeoutPayload,
} from '../types'
import { type Run, type RunState } from '../types/run'
import { type EventEmitter } from './events'
import { type RunStateMachine, type TransitionResult } from './run-state-machine'

/**
 * Approval request status
 */
export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected', 'timeout'])
export type ApprovalStatus = z.infer<typeof ApprovalStatus>

/**
 * Source of approval action
 */
export const ApprovalSource = z.enum(['web', 'desktop', 'mobile', 'api', 'timeout', 'bulk'])
export type ApprovalSource = z.infer<typeof ApprovalSource>

/**
 * Rejection reason - maps to state machine transitions
 */
export const RejectionReason = z.enum(['user_cancelled', 'needs_edit', 'policy_violation'])
export type RejectionReason = z.infer<typeof RejectionReason>

/**
 * Auto-action on timeout
 */
export const TimeoutAction = z.enum(['approve', 'reject'])
export type TimeoutAction = z.infer<typeof TimeoutAction>

/**
 * Pending approval request
 */
export interface PendingApproval {
  /** Unique checkpoint ID */
  checkpoint_id: string
  /** Run this approval belongs to */
  run_id: string
  /** Action type being requested (e.g., 'send_email', 'create_pr') */
  action_type: string
  /** Preview of the action */
  preview: Record<string, unknown>
  /** When the request was created */
  requested_at: string
  /** When the request times out */
  expires_at: string
  /** Action to take on timeout */
  timeout_action: TimeoutAction
  /** Current status */
  status: ApprovalStatus
  /** Phase when approval was requested */
  requested_from_phase: Phase
}

/**
 * Approval audit log entry
 */
export interface ApprovalAuditEntry {
  /** Unique audit ID */
  audit_id: string
  /** Checkpoint being acted on */
  checkpoint_id: string
  /** Run ID */
  run_id: string
  /** Action taken */
  action: 'approved' | 'rejected' | 'timeout'
  /** Who took the action (null for timeout) */
  actor_id: string | null
  /** Source of the action */
  source: ApprovalSource
  /** Rejection reason (if rejected) */
  rejection_reason?: RejectionReason
  /** When the action occurred */
  timestamp: string
}

/**
 * Result of an approval operation
 */
export interface ApprovalResult {
  success: boolean
  checkpoint_id: string
  status: ApprovalStatus
  transition?: TransitionResult
  error?: string
}

/**
 * Options for requesting approval
 */
export interface RequestApprovalOptions {
  /** Timeout in seconds (default from contract) */
  timeout_seconds: number
  /** Action on timeout (default: reject) */
  timeout_action?: TimeoutAction
}

/**
 * Options for bulk approval
 */
export interface BulkApprovalOptions {
  /** Approve by action type (e.g., all 'send_email') */
  action_type?: string
  /** Approve by run ID */
  run_id?: string
  /** Limit number of approvals */
  limit?: number
}

/**
 * ApprovalService interface - manages approval workflow
 *
 * This service:
 * 1. Tracks pending approval requests
 * 2. Handles approval/rejection with state machine integration
 * 3. Manages timeouts with configurable auto-action
 * 4. Supports bulk approvals
 * 5. Maintains audit log
 */
export interface ApprovalService {
  /**
   * Request approval for a checkpoint
   *
   * Called by orchestrator when agent requests checkpoint.
   * Transitions run to awaiting_approval state.
   */
  requestApproval(
    run: Run,
    payload: CheckpointRequestedPayload,
    options?: RequestApprovalOptions,
  ): ApprovalResult

  /**
   * Approve a pending checkpoint
   */
  approve(
    checkpointId: string,
    approverId: string,
    source: ApprovalSource,
  ): ApprovalResult

  /**
   * Reject a pending checkpoint
   */
  reject(
    checkpointId: string,
    reason: RejectionReason,
    rejectorId?: string,
    source?: ApprovalSource,
  ): ApprovalResult

  /**
   * Bulk approve matching checkpoints
   */
  bulkApprove(
    approverId: string,
    options: BulkApprovalOptions,
    source?: ApprovalSource,
  ): ApprovalResult[]

  /**
   * Get a pending approval by checkpoint ID
   */
  getPending(checkpointId: string): PendingApproval | undefined

  /**
   * Get all pending approvals for a run
   */
  getPendingForRun(runId: string): PendingApproval[]

  /**
   * Get all pending approvals (optionally filtered by action type)
   */
  getAllPending(actionType?: string): PendingApproval[]

  /**
   * Check for and handle expired approvals
   * Called periodically by orchestrator
   */
  processTimeouts(): ApprovalResult[]

  /**
   * Get audit log for a checkpoint
   */
  getAuditLog(checkpointId: string): ApprovalAuditEntry[]

  /**
   * Get audit log for a run
   */
  getAuditLogForRun(runId: string): ApprovalAuditEntry[]
}

/**
 * In-memory ApprovalService implementation
 *
 * Suitable for development and single-instance deployments.
 */
export class InMemoryApprovalService implements ApprovalService {
  /** Pending approvals keyed by checkpoint_id */
  private pending: Map<string, PendingApproval> = new Map()

  /** Audit log entries keyed by checkpoint_id */
  private auditLog: Map<string, ApprovalAuditEntry[]> = new Map()

  /** Run ID to checkpoint IDs mapping */
  private runCheckpoints: Map<string, Set<string>> = new Map()

  /** Counter for audit IDs */
  private auditCounter = 0

  constructor(
    private readonly eventEmitter: EventEmitter,
    private readonly stateMachine: RunStateMachine,
    /** Function to get/update run state - injected for flexibility */
    private readonly getRun: (runId: string) => Run | undefined,
    private readonly updateRun: (runId: string, updates: Partial<Run>) => void,
  ) {}

  requestApproval(
    run: Run,
    payload: CheckpointRequestedPayload,
    options?: RequestApprovalOptions,
  ): ApprovalResult {
    const { checkpoint_id, action_type, preview, timeout_seconds } = payload
    const timeoutSecs = options?.timeout_seconds ?? timeout_seconds
    const timeoutAction = options?.timeout_action ?? 'reject'

    // Check if checkpoint already exists
    if (this.pending.has(checkpoint_id)) {
      return {
        success: false,
        checkpoint_id,
        status: 'pending',
        error: `Checkpoint ${checkpoint_id} already exists`,
      }
    }

    // Transition run to awaiting_approval
    let transition: TransitionResult
    try {
      transition = this.stateMachine.transition(run, {
        targetState: 'awaiting_approval',
        reason: `Checkpoint requested: ${action_type}`,
      })
    } catch (error) {
      return {
        success: false,
        checkpoint_id,
        status: 'pending',
        error: error instanceof Error ? error.message : 'State transition failed',
      }
    }

    // Calculate expiration
    const now = new Date()
    const expiresAt = new Date(now.getTime() + timeoutSecs * 1000)

    // Create pending approval
    const pendingApproval: PendingApproval = {
      checkpoint_id,
      run_id: run.run_id,
      action_type,
      preview,
      requested_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      timeout_action: timeoutAction,
      status: 'pending',
      requested_from_phase: run.state as Phase,
    }

    // Store pending approval
    this.pending.set(checkpoint_id, pendingApproval)

    // Track by run ID
    if (!this.runCheckpoints.has(run.run_id)) {
      this.runCheckpoints.set(run.run_id, new Set())
    }
    this.runCheckpoints.get(run.run_id)!.add(checkpoint_id)

    // Update run state
    this.updateRun(run.run_id, {
      state: transition.newState,
      previous_state: transition.previousState,
    })

    return {
      success: true,
      checkpoint_id,
      status: 'pending',
      transition,
    }
  }

  approve(
    checkpointId: string,
    approverId: string,
    source: ApprovalSource,
  ): ApprovalResult {
    const pending = this.pending.get(checkpointId)
    if (!pending) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: `Checkpoint ${checkpointId} not found`,
      }
    }

    if (pending.status !== 'pending') {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: pending.status,
        error: `Checkpoint ${checkpointId} already ${pending.status}`,
      }
    }

    // Get run
    const run = this.getRun(pending.run_id)
    if (!run) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: `Run ${pending.run_id} not found`,
      }
    }

    // Perform approve action via state machine
    let transition: TransitionResult
    try {
      transition = this.stateMachine.performAction(run, { action: 'approve' })
    } catch (error) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: error instanceof Error ? error.message : 'State transition failed',
      }
    }

    // Update pending status
    pending.status = 'approved'

    // Emit checkpoint.approved event
    this.eventEmitter.emit(
      pending.run_id,
      'checkpoint.approved',
      {
        checkpoint_id: checkpointId,
        approver_id: approverId,
        approved_from: source === 'bulk' ? 'api' : source,
      } as CheckpointApprovedPayload,
      transition.newState as Phase,
      'info',
    )

    // Audit log
    this.addAuditEntry({
      checkpoint_id: checkpointId,
      run_id: pending.run_id,
      action: 'approved',
      actor_id: approverId,
      source,
    })

    // Update run state
    this.updateRun(pending.run_id, {
      state: transition.newState,
      previous_state: transition.previousState,
    })

    return {
      success: true,
      checkpoint_id: checkpointId,
      status: 'approved',
      transition,
    }
  }

  reject(
    checkpointId: string,
    reason: RejectionReason,
    rejectorId?: string,
    source: ApprovalSource = 'web',
  ): ApprovalResult {
    const pending = this.pending.get(checkpointId)
    if (!pending) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: `Checkpoint ${checkpointId} not found`,
      }
    }

    if (pending.status !== 'pending') {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: pending.status,
        error: `Checkpoint ${checkpointId} already ${pending.status}`,
      }
    }

    // Get run
    const run = this.getRun(pending.run_id)
    if (!run) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: `Run ${pending.run_id} not found`,
      }
    }

    // Perform reject action via state machine
    let transition: TransitionResult
    try {
      transition = this.stateMachine.performAction(run, {
        action: 'reject',
        context: { rejectReason: reason },
      })
    } catch (error) {
      return {
        success: false,
        checkpoint_id: checkpointId,
        status: 'pending',
        error: error instanceof Error ? error.message : 'State transition failed',
      }
    }

    // Update pending status
    pending.status = 'rejected'

    // Emit checkpoint.rejected event
    this.eventEmitter.emit(
      pending.run_id,
      'checkpoint.rejected',
      {
        checkpoint_id: checkpointId,
        reason,
        rejector_id: rejectorId,
      } as CheckpointRejectedPayload,
      transition.newState as Phase,
      'warning',
    )

    // Audit log
    this.addAuditEntry({
      checkpoint_id: checkpointId,
      run_id: pending.run_id,
      action: 'rejected',
      actor_id: rejectorId ?? null,
      source,
      rejection_reason: reason,
    })

    // Update run state
    this.updateRun(pending.run_id, {
      state: transition.newState,
      previous_state: transition.previousState,
    })

    return {
      success: true,
      checkpoint_id: checkpointId,
      status: 'rejected',
      transition,
    }
  }

  bulkApprove(
    approverId: string,
    options: BulkApprovalOptions,
    source: ApprovalSource = 'api',
  ): ApprovalResult[] {
    const results: ApprovalResult[] = []
    const limit = options.limit ?? Infinity

    // Filter pending approvals
    let candidates = Array.from(this.pending.values()).filter(
      (p) => p.status === 'pending',
    )

    if (options.action_type) {
      candidates = candidates.filter((p) => p.action_type === options.action_type)
    }

    if (options.run_id) {
      candidates = candidates.filter((p) => p.run_id === options.run_id)
    }

    // Apply limit
    candidates = candidates.slice(0, limit)

    // Approve each
    for (const pending of candidates) {
      const result = this.approve(pending.checkpoint_id, approverId, 'bulk')
      results.push(result)
    }

    return results
  }

  getPending(checkpointId: string): PendingApproval | undefined {
    return this.pending.get(checkpointId)
  }

  getPendingForRun(runId: string): PendingApproval[] {
    const checkpointIds = this.runCheckpoints.get(runId)
    if (!checkpointIds) return []

    return Array.from(checkpointIds)
      .map((id) => this.pending.get(id))
      .filter((p): p is PendingApproval => p !== undefined && p.status === 'pending')
  }

  getAllPending(actionType?: string): PendingApproval[] {
    let pending = Array.from(this.pending.values()).filter(
      (p) => p.status === 'pending',
    )

    if (actionType) {
      pending = pending.filter((p) => p.action_type === actionType)
    }

    return pending
  }

  processTimeouts(): ApprovalResult[] {
    const results: ApprovalResult[] = []
    const now = new Date()

    for (const pending of this.pending.values()) {
      if (pending.status !== 'pending') continue

      const expiresAt = new Date(pending.expires_at)
      if (now < expiresAt) continue

      // Get run
      const run = this.getRun(pending.run_id)
      if (!run) continue

      // Handle timeout based on configured action
      if (pending.timeout_action === 'approve') {
        // Auto-approve
        const result = this.handleTimeoutApprove(pending, run)
        results.push(result)
      } else {
        // Auto-reject (default)
        const result = this.handleTimeoutReject(pending, run)
        results.push(result)
      }
    }

    return results
  }

  getAuditLog(checkpointId: string): ApprovalAuditEntry[] {
    return this.auditLog.get(checkpointId) ?? []
  }

  getAuditLogForRun(runId: string): ApprovalAuditEntry[] {
    const checkpointIds = this.runCheckpoints.get(runId)
    if (!checkpointIds) return []

    const entries: ApprovalAuditEntry[] = []
    for (const id of checkpointIds) {
      entries.push(...(this.auditLog.get(id) ?? []))
    }

    // Sort by timestamp
    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  private handleTimeoutApprove(pending: PendingApproval, run: Run): ApprovalResult {
    let transition: TransitionResult
    try {
      transition = this.stateMachine.performAction(run, { action: 'approve' })
    } catch (error) {
      return {
        success: false,
        checkpoint_id: pending.checkpoint_id,
        status: 'pending',
        error: error instanceof Error ? error.message : 'State transition failed',
      }
    }

    // Update pending status
    pending.status = 'timeout'

    // Emit checkpoint.timeout event
    this.eventEmitter.emit(
      pending.run_id,
      'checkpoint.timeout',
      {
        checkpoint_id: pending.checkpoint_id,
        auto_action: 'approve',
      } as CheckpointTimeoutPayload,
      transition.newState as Phase,
      'warning',
    )

    // Audit log
    this.addAuditEntry({
      checkpoint_id: pending.checkpoint_id,
      run_id: pending.run_id,
      action: 'timeout',
      actor_id: null,
      source: 'timeout',
    })

    // Update run state
    this.updateRun(pending.run_id, {
      state: transition.newState,
      previous_state: transition.previousState,
    })

    return {
      success: true,
      checkpoint_id: pending.checkpoint_id,
      status: 'timeout',
      transition,
    }
  }

  private handleTimeoutReject(pending: PendingApproval, run: Run): ApprovalResult {
    // Timeout rejection transitions to the timeout state
    let transition: TransitionResult
    try {
      transition = this.stateMachine.transition(run, {
        targetState: 'timeout',
        reason: 'Approval timeout',
      })
    } catch (error) {
      return {
        success: false,
        checkpoint_id: pending.checkpoint_id,
        status: 'pending',
        error: error instanceof Error ? error.message : 'State transition failed',
      }
    }

    // Update pending status
    pending.status = 'timeout'

    // Emit checkpoint.timeout event
    this.eventEmitter.emit(
      pending.run_id,
      'checkpoint.timeout',
      {
        checkpoint_id: pending.checkpoint_id,
        auto_action: 'reject',
      } as CheckpointTimeoutPayload,
      transition.newState as Phase,
      'error',
    )

    // Audit log
    this.addAuditEntry({
      checkpoint_id: pending.checkpoint_id,
      run_id: pending.run_id,
      action: 'timeout',
      actor_id: null,
      source: 'timeout',
    })

    // Update run state
    this.updateRun(pending.run_id, {
      state: transition.newState,
      previous_state: transition.previousState,
    })

    return {
      success: true,
      checkpoint_id: pending.checkpoint_id,
      status: 'timeout',
      transition,
    }
  }

  private addAuditEntry(
    entry: Omit<ApprovalAuditEntry, 'audit_id' | 'timestamp'>,
  ): void {
    const auditEntry: ApprovalAuditEntry = {
      ...entry,
      audit_id: `audit_${++this.auditCounter}`,
      timestamp: new Date().toISOString(),
    }

    if (!this.auditLog.has(entry.checkpoint_id)) {
      this.auditLog.set(entry.checkpoint_id, [])
    }
    this.auditLog.get(entry.checkpoint_id)!.push(auditEntry)
  }
}

/**
 * Factory function for creating ApprovalService instances
 */
export function createApprovalService(
  eventEmitter: EventEmitter,
  stateMachine: RunStateMachine,
  getRun: (runId: string) => Run | undefined,
  updateRun: (runId: string, updates: Partial<Run>) => void,
): ApprovalService {
  return new InMemoryApprovalService(eventEmitter, stateMachine, getRun, updateRun)
}
