import { z } from 'zod'
import {
  type Run,
  type RunState,
  RunSchema,
  type ArtifactRef,
  ArtifactRefSchema,
  type RunTimestamps,
  isTerminalState,
} from '../types/run'
import { type RunContract } from '../types/contract'
import { type Event } from '../types'
import { type EventStore, type EventPage, type EventQueryOptions } from './event-store'

/**
 * Result type for RunDB operations
 */
export type RunDBResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Run filter options for listing
 */
export interface RunFilter {
  /** Filter by workspace ID */
  workspace_id?: string
  /** Filter by template ID */
  template_id?: string
  /** Filter by state(s) */
  states?: RunState[]
  /** Include only terminal states */
  terminal_only?: boolean
  /** Include only active states */
  active_only?: boolean
}

/**
 * Pagination options for run listing
 */
export interface RunPagination {
  /** Number of runs to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Sort by field */
  sort_by?: 'created_at' | 'updated_at'
  /** Sort direction */
  sort_order?: 'asc' | 'desc'
}

/**
 * Paginated run list result
 */
export interface RunListResult {
  runs: Run[]
  total: number
  hasMore: boolean
}

/**
 * Approval audit entry for RunDB
 * Distinct from ApprovalAuditEntry in approvals service - this is the persistent record
 */
export const ApprovalAuditAction = z.enum(['approved', 'rejected', 'timeout'])
export type ApprovalAuditAction = z.infer<typeof ApprovalAuditAction>

export const ApprovalAuditSource = z.enum(['web', 'desktop', 'mobile', 'api', 'timeout', 'bulk'])
export type ApprovalAuditSource = z.infer<typeof ApprovalAuditSource>

export const ApprovalAuditRecordSchema = z.object({
  audit_id: z.string(),
  run_id: z.string(),
  checkpoint_id: z.string(),
  action: ApprovalAuditAction,
  approver_id: z.string().nullable(),
  source: ApprovalAuditSource,
  rejection_reason: z.string().optional(),
  timestamp: z.string().datetime(),
})
export type ApprovalAuditRecord = z.infer<typeof ApprovalAuditRecordSchema>

/**
 * Input for creating a new run
 */
export interface CreateRunInput {
  workspace_id: string
  template_id: string
  template_version: string
  contract: RunContract
}

/**
 * Input for run state update
 */
export interface UpdateRunStateInput {
  state: RunState
  previous_state?: RunState | null
  error?: {
    type: string
    message: string
    recoverable: boolean
  } | null
}

/**
 * Transaction context for atomic operations
 */
export interface RunDBTransaction {
  /** Commit the transaction */
  commit(): Promise<RunDBResult<void>>
  /** Rollback the transaction */
  rollback(): Promise<void>
  /** Create a run within transaction */
  createRun(input: CreateRunInput): Promise<RunDBResult<Run>>
  /** Append events within transaction */
  appendEvents(runId: string, events: Event[]): Promise<RunDBResult<void>>
}

/**
 * RunDB interface - the system ledger for runs
 *
 * This is the persistence layer for:
 * - Run metadata (goal, template, scopes)
 * - Event log (via EventStore abstraction)
 * - Artifact pointers (vault paths + object store URIs)
 * - Approval audit log
 *
 * Designed for backend swap: SQLite for local, Convex for web.
 */
export interface RunDB {
  // ─────────────────────────────────────────────────────────────────
  // Run CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new run
   *
   * @param input - Run creation parameters
   * @returns The created run with generated run_id
   */
  createRun(input: CreateRunInput): Promise<RunDBResult<Run>>

  /**
   * Get a run by ID
   *
   * @param runId - The run ID to retrieve
   * @returns The run or not found error
   */
  getRun(runId: string): Promise<RunDBResult<Run>>

  /**
   * List runs with filtering and pagination
   *
   * @param filter - Optional filter criteria
   * @param pagination - Optional pagination settings
   * @returns Paginated run list
   */
  listRuns(filter?: RunFilter, pagination?: RunPagination): Promise<RunDBResult<RunListResult>>

  /**
   * Update run state
   *
   * Updates state, previous_state, error, and timestamps.updated_at.
   * Validates the run exists and state transition is meaningful.
   *
   * @param runId - The run to update
   * @param input - State update parameters
   * @returns The updated run
   */
  updateRunState(runId: string, input: UpdateRunStateInput): Promise<RunDBResult<Run>>

  /**
   * Update run execution environment
   *
   * Called when sandbox is provisioned.
   *
   * @param runId - The run to update
   * @param executionEnv - Execution environment details
   * @returns The updated run
   */
  updateExecutionEnv(
    runId: string,
    executionEnv: {
      sandbox_id: string
      template_id: string
      created_at: string
    },
  ): Promise<RunDBResult<Run>>

  /**
   * Mark run as started
   *
   * Sets timestamps.started_at if not already set.
   *
   * @param runId - The run to mark started
   * @returns The updated run
   */
  markRunStarted(runId: string): Promise<RunDBResult<Run>>

  /**
   * Mark run as completed
   *
   * Sets timestamps.completed_at and final cost.
   *
   * @param runId - The run to mark completed
   * @param cost - Final cost breakdown (optional)
   * @returns The updated run
   */
  markRunCompleted(
    runId: string,
    cost?: { compute_cents: number; api_cents: number },
  ): Promise<RunDBResult<Run>>

  /**
   * Check if a run exists
   *
   * @param runId - The run ID to check
   * @returns Whether the run exists
   */
  runExists(runId: string): Promise<boolean>

  // ─────────────────────────────────────────────────────────────────
  // Event Log (via EventStore)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Append events to a run's event log
   *
   * Delegates to EventStore. Updates run's last_event_seq.
   *
   * @param runId - The run to append events to
   * @param events - Events to append (must be in seq order)
   * @returns Success or error
   */
  appendEvents(runId: string, events: Event[]): Promise<RunDBResult<void>>

  /**
   * Query events for a run
   *
   * Delegates to EventStore.
   *
   * @param runId - The run to query events for
   * @param options - Query options (afterSeq, limit, types)
   * @returns Paginated event result
   */
  queryEvents(runId: string, options?: EventQueryOptions): Promise<RunDBResult<EventPage>>

  /**
   * Get the underlying EventStore
   *
   * For direct access when needed (e.g., SSE streaming).
   */
  getEventStore(): EventStore

  // ─────────────────────────────────────────────────────────────────
  // Artifact Pointers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add an artifact reference to a run
   *
   * @param runId - The run to add artifact to
   * @param artifact - Artifact reference (vault path + optional object URI)
   * @returns The updated run
   */
  addArtifact(runId: string, artifact: ArtifactRef): Promise<RunDBResult<Run>>

  /**
   * Get artifacts for a run
   *
   * @param runId - The run to get artifacts for
   * @returns List of artifact references
   */
  getArtifacts(runId: string): Promise<RunDBResult<ArtifactRef[]>>

  /**
   * Update artifact reference (e.g., add object store URI after upload)
   *
   * @param runId - The run containing the artifact
   * @param artifactId - The artifact to update
   * @param updates - Partial artifact updates
   * @returns The updated run
   */
  updateArtifact(
    runId: string,
    artifactId: string,
    updates: Partial<ArtifactRef>,
  ): Promise<RunDBResult<Run>>

  // ─────────────────────────────────────────────────────────────────
  // Approval Audit Log
  // ─────────────────────────────────────────────────────────────────

  /**
   * Log an approval action
   *
   * @param record - The approval audit record
   * @returns Success or error
   */
  logApproval(record: Omit<ApprovalAuditRecord, 'audit_id'>): Promise<RunDBResult<ApprovalAuditRecord>>

  /**
   * Get approval audit log for a run
   *
   * @param runId - The run to get audit log for
   * @returns List of approval audit records
   */
  getApprovalAuditLog(runId: string): Promise<RunDBResult<ApprovalAuditRecord[]>>

  /**
   * Get approval audit log for a specific checkpoint
   *
   * @param checkpointId - The checkpoint to get audit log for
   * @returns List of approval audit records
   */
  getApprovalAuditLogForCheckpoint(checkpointId: string): Promise<RunDBResult<ApprovalAuditRecord[]>>

  // ─────────────────────────────────────────────────────────────────
  // Transactions
  // ─────────────────────────────────────────────────────────────────

  /**
   * Begin a transaction for atomic operations
   *
   * Use for atomic run creation + initial events.
   *
   * @returns Transaction context
   */
  beginTransaction(): Promise<RunDBTransaction>

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────

  /**
   * Delete a run and all associated data
   *
   * Deletes: run record, events, artifact refs, approval audit log.
   * Use with caution - primarily for testing/cleanup.
   *
   * @param runId - The run to delete
   * @returns Success or error
   */
  deleteRun(runId: string): Promise<RunDBResult<void>>
}

/**
 * In-memory RunDB implementation
 *
 * Suitable for development and testing.
 * For production, implement SQLite or Convex-backed version.
 */
export class InMemoryRunDB implements RunDB {
  /** Runs indexed by run_id */
  private runs: Map<string, Run> = new Map()

  /** Approval audit records indexed by run_id */
  private approvalAuditByRun: Map<string, ApprovalAuditRecord[]> = new Map()

  /** Approval audit records indexed by checkpoint_id */
  private approvalAuditByCheckpoint: Map<string, ApprovalAuditRecord[]> = new Map()

  /** Counter for audit IDs */
  private auditCounter = 0

  /** Default pagination limit */
  private defaultLimit = 50

  constructor(private readonly eventStore: EventStore) {}

  // ─────────────────────────────────────────────────────────────────
  // Run CRUD
  // ─────────────────────────────────────────────────────────────────

  async createRun(input: CreateRunInput): Promise<RunDBResult<Run>> {
    const now = new Date().toISOString()
    const runId = `run_${crypto.randomUUID()}`

    const run: Run = {
      run_id: runId,
      workspace_id: input.workspace_id,
      template_id: input.template_id,
      template_version: input.template_version,
      contract: input.contract,
      execution_env: null,
      state: 'pending',
      previous_state: null,
      timestamps: {
        created_at: now,
        started_at: null,
        completed_at: null,
        updated_at: now,
      },
      event_stream_url: undefined,
      last_event_seq: -1,
      cost: null,
      artifacts: [],
      error: null,
    }

    // Validate the run
    const parseResult = RunSchema.safeParse(run)
    if (!parseResult.success) {
      return { success: false, error: `Invalid run: ${parseResult.error.message}` }
    }

    this.runs.set(runId, run)
    return { success: true, data: run }
  }

  async getRun(runId: string): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }
    return { success: true, data: run }
  }

  async listRuns(filter?: RunFilter, pagination?: RunPagination): Promise<RunDBResult<RunListResult>> {
    let runs = Array.from(this.runs.values())

    // Apply filters
    if (filter) {
      if (filter.workspace_id) {
        runs = runs.filter((r) => r.workspace_id === filter.workspace_id)
      }
      if (filter.template_id) {
        runs = runs.filter((r) => r.template_id === filter.template_id)
      }
      if (filter.states && filter.states.length > 0) {
        runs = runs.filter((r) => filter.states!.includes(r.state))
      }
      if (filter.terminal_only) {
        runs = runs.filter((r) => isTerminalState(r.state))
      }
      if (filter.active_only) {
        runs = runs.filter((r) => !isTerminalState(r.state))
      }
    }

    // Sort
    const sortBy = pagination?.sort_by ?? 'created_at'
    const sortOrder = pagination?.sort_order ?? 'desc'
    runs.sort((a, b) => {
      const aVal = sortBy === 'created_at' ? a.timestamps.created_at : a.timestamps.updated_at
      const bVal = sortBy === 'created_at' ? b.timestamps.created_at : b.timestamps.updated_at
      const cmp = aVal.localeCompare(bVal)
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Paginate
    const total = runs.length
    const offset = pagination?.offset ?? 0
    const limit = pagination?.limit ?? this.defaultLimit
    const paginated = runs.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return {
      success: true,
      data: {
        runs: paginated,
        total,
        hasMore,
      },
    }
  }

  async updateRunState(runId: string, input: UpdateRunStateInput): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    // Update state
    run.state = input.state
    if (input.previous_state !== undefined) {
      run.previous_state = input.previous_state
    }
    if (input.error !== undefined) {
      run.error = input.error
    }
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: run }
  }

  async updateExecutionEnv(
    runId: string,
    executionEnv: { sandbox_id: string; template_id: string; created_at: string },
  ): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    run.execution_env = executionEnv
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: run }
  }

  async markRunStarted(runId: string): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    if (!run.timestamps.started_at) {
      run.timestamps.started_at = new Date().toISOString()
    }
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: run }
  }

  async markRunCompleted(
    runId: string,
    cost?: { compute_cents: number; api_cents: number },
  ): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    run.timestamps.completed_at = new Date().toISOString()
    run.timestamps.updated_at = run.timestamps.completed_at

    if (cost) {
      run.cost = {
        compute_cents: cost.compute_cents,
        api_cents: cost.api_cents,
        total_cents: cost.compute_cents + cost.api_cents,
      }
    }

    return { success: true, data: run }
  }

  async runExists(runId: string): Promise<boolean> {
    return this.runs.has(runId)
  }

  // ─────────────────────────────────────────────────────────────────
  // Event Log
  // ─────────────────────────────────────────────────────────────────

  async appendEvents(runId: string, events: Event[]): Promise<RunDBResult<void>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    if (events.length === 0) {
      return { success: true, data: undefined }
    }

    // Validate events belong to this run
    if (!events.every((e) => e.run_id === runId)) {
      return { success: false, error: 'All events must belong to the specified run' }
    }

    // Append to event store
    const result = await this.eventStore.appendBatch(events)
    if (!result.success) {
      return result
    }

    // Update run's last_event_seq
    const lastEvent = events[events.length - 1]
    run.last_event_seq = lastEvent.seq
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: undefined }
  }

  async queryEvents(runId: string, options?: EventQueryOptions): Promise<RunDBResult<EventPage>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    return this.eventStore.query(runId, options)
  }

  getEventStore(): EventStore {
    return this.eventStore
  }

  // ─────────────────────────────────────────────────────────────────
  // Artifact Pointers
  // ─────────────────────────────────────────────────────────────────

  async addArtifact(runId: string, artifact: ArtifactRef): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    // Validate artifact
    const parseResult = ArtifactRefSchema.safeParse(artifact)
    if (!parseResult.success) {
      return { success: false, error: `Invalid artifact: ${parseResult.error.message}` }
    }

    // Check for duplicate
    if (run.artifacts.some((a) => a.artifact_id === artifact.artifact_id)) {
      return { success: false, error: `Artifact already exists: ${artifact.artifact_id}` }
    }

    run.artifacts.push(artifact)
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: run }
  }

  async getArtifacts(runId: string): Promise<RunDBResult<ArtifactRef[]>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    return { success: true, data: run.artifacts }
  }

  async updateArtifact(
    runId: string,
    artifactId: string,
    updates: Partial<ArtifactRef>,
  ): Promise<RunDBResult<Run>> {
    const run = this.runs.get(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    const artifactIndex = run.artifacts.findIndex((a) => a.artifact_id === artifactId)
    if (artifactIndex === -1) {
      return { success: false, error: `Artifact not found: ${artifactId}` }
    }

    // Update artifact (excluding artifact_id)
    const existing = run.artifacts[artifactIndex]
    run.artifacts[artifactIndex] = {
      ...existing,
      ...updates,
      artifact_id: existing.artifact_id, // Never change the ID
    }
    run.timestamps.updated_at = new Date().toISOString()

    return { success: true, data: run }
  }

  // ─────────────────────────────────────────────────────────────────
  // Approval Audit Log
  // ─────────────────────────────────────────────────────────────────

  async logApproval(
    record: Omit<ApprovalAuditRecord, 'audit_id'>,
  ): Promise<RunDBResult<ApprovalAuditRecord>> {
    // Validate run exists
    if (!this.runs.has(record.run_id)) {
      return { success: false, error: `Run not found: ${record.run_id}` }
    }

    const auditRecord: ApprovalAuditRecord = {
      ...record,
      audit_id: `audit_${++this.auditCounter}`,
    }

    // Store by run_id
    if (!this.approvalAuditByRun.has(record.run_id)) {
      this.approvalAuditByRun.set(record.run_id, [])
    }
    this.approvalAuditByRun.get(record.run_id)!.push(auditRecord)

    // Store by checkpoint_id
    if (!this.approvalAuditByCheckpoint.has(record.checkpoint_id)) {
      this.approvalAuditByCheckpoint.set(record.checkpoint_id, [])
    }
    this.approvalAuditByCheckpoint.get(record.checkpoint_id)!.push(auditRecord)

    return { success: true, data: auditRecord }
  }

  async getApprovalAuditLog(runId: string): Promise<RunDBResult<ApprovalAuditRecord[]>> {
    if (!this.runs.has(runId)) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    const records = this.approvalAuditByRun.get(runId) ?? []
    // Sort by timestamp
    return {
      success: true,
      data: [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }
  }

  async getApprovalAuditLogForCheckpoint(
    checkpointId: string,
  ): Promise<RunDBResult<ApprovalAuditRecord[]>> {
    const records = this.approvalAuditByCheckpoint.get(checkpointId) ?? []
    return {
      success: true,
      data: [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Transactions
  // ─────────────────────────────────────────────────────────────────

  async beginTransaction(): Promise<RunDBTransaction> {
    // For in-memory, transactions are simulated via staging
    return new InMemoryRunDBTransaction(this, this.eventStore)
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────

  async deleteRun(runId: string): Promise<RunDBResult<void>> {
    if (!this.runs.has(runId)) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    // Delete events
    await this.eventStore.deleteRun(runId)

    // Delete approval audit records
    this.approvalAuditByRun.delete(runId)
    // Note: We leave checkpoint-indexed records as they may be referenced elsewhere

    // Delete run
    this.runs.delete(runId)

    return { success: true, data: undefined }
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal methods for transaction support
  // ─────────────────────────────────────────────────────────────────

  /** @internal - Used by transaction to commit run */
  _commitRun(run: Run): void {
    this.runs.set(run.run_id, run)
  }

  /** @internal - Used by transaction to check run existence */
  _hasRun(runId: string): boolean {
    return this.runs.has(runId)
  }
}

/**
 * In-memory transaction implementation
 *
 * Stages changes and applies them on commit.
 */
class InMemoryRunDBTransaction implements RunDBTransaction {
  private stagedRun: Run | null = null
  private stagedEvents: Event[] = []
  private committed = false
  private rolledBack = false

  constructor(
    private readonly db: InMemoryRunDB,
    private readonly eventStore: EventStore,
  ) {}

  async createRun(input: CreateRunInput): Promise<RunDBResult<Run>> {
    if (this.committed || this.rolledBack) {
      return { success: false, error: 'Transaction already completed' }
    }

    if (this.stagedRun) {
      return { success: false, error: 'Transaction already has a staged run' }
    }

    const now = new Date().toISOString()
    const runId = `run_${crypto.randomUUID()}`

    const run: Run = {
      run_id: runId,
      workspace_id: input.workspace_id,
      template_id: input.template_id,
      template_version: input.template_version,
      contract: input.contract,
      execution_env: null,
      state: 'pending',
      previous_state: null,
      timestamps: {
        created_at: now,
        started_at: null,
        completed_at: null,
        updated_at: now,
      },
      event_stream_url: undefined,
      last_event_seq: -1,
      cost: null,
      artifacts: [],
      error: null,
    }

    // Validate
    const parseResult = RunSchema.safeParse(run)
    if (!parseResult.success) {
      return { success: false, error: `Invalid run: ${parseResult.error.message}` }
    }

    this.stagedRun = run
    return { success: true, data: run }
  }

  async appendEvents(runId: string, events: Event[]): Promise<RunDBResult<void>> {
    if (this.committed || this.rolledBack) {
      return { success: false, error: 'Transaction already completed' }
    }

    // Validate run matches staged run or exists in DB
    if (this.stagedRun && this.stagedRun.run_id === runId) {
      // Events for the staged run
      if (!events.every((e) => e.run_id === runId)) {
        return { success: false, error: 'All events must belong to the specified run' }
      }
      this.stagedEvents.push(...events)
      return { success: true, data: undefined }
    }

    // Check if run exists in DB
    if (!this.db._hasRun(runId)) {
      return { success: false, error: `Run not found: ${runId}` }
    }

    // For existing runs, append directly (not part of atomic transaction)
    return this.db.appendEvents(runId, events)
  }

  async commit(): Promise<RunDBResult<void>> {
    if (this.committed) {
      return { success: false, error: 'Transaction already committed' }
    }
    if (this.rolledBack) {
      return { success: false, error: 'Transaction was rolled back' }
    }

    try {
      // Commit staged run
      if (this.stagedRun) {
        this.db._commitRun(this.stagedRun)

        // Update last_event_seq if we have staged events
        if (this.stagedEvents.length > 0) {
          this.stagedRun.last_event_seq = this.stagedEvents[this.stagedEvents.length - 1].seq
        }
      }

      // Commit staged events
      if (this.stagedEvents.length > 0) {
        const result = await this.eventStore.appendBatch(this.stagedEvents)
        if (!result.success) {
          // Rollback run if events fail
          if (this.stagedRun) {
            await this.db.deleteRun(this.stagedRun.run_id)
          }
          return result
        }
      }

      this.committed = true
      return { success: true, data: undefined }
    } catch (error) {
      // Rollback on error
      if (this.stagedRun) {
        await this.db.deleteRun(this.stagedRun.run_id).catch(() => {})
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction commit failed',
      }
    }
  }

  async rollback(): Promise<void> {
    if (this.committed) {
      throw new Error('Cannot rollback committed transaction')
    }
    this.rolledBack = true
    this.stagedRun = null
    this.stagedEvents = []
  }
}

/**
 * Factory function for creating RunDB instances
 *
 * @param eventStore - EventStore for event persistence
 * @param env - Environment ('development' | 'production' | 'test')
 * @returns RunDB implementation appropriate for the environment
 */
export function createRunDB(eventStore: EventStore, env?: string): RunDB {
  // For now, always return in-memory implementation
  // In production, this would return SQLite or Convex-backed implementation
  return new InMemoryRunDB(eventStore)
}
