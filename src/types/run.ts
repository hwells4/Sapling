import { z } from 'zod'
import { RunContractSchema } from './contract'

/**
 * Run states - orchestrator controls all transitions.
 *
 * State machine transitions:
 *
 * pending → initializing (on sandbox request)
 * initializing → planning (on sandbox ready)
 * initializing → failed (on sandbox creation error)
 *
 * planning → executing (on plan phase complete)
 * planning → awaiting_approval (on checkpoint.requested)
 * planning → failed (on unrecoverable error)
 * planning → paused (on user pause)
 *
 * executing → verifying (on execute phase complete)
 * executing → awaiting_approval (on checkpoint.requested)
 * executing → failed (on unrecoverable error)
 * executing → paused (on user pause)
 *
 * verifying → packaging (on verify phase complete)
 * verifying → executing (on verification failure requiring retry)
 * verifying → failed (on unrecoverable error)
 *
 * packaging → completed (on artifacts written)
 * packaging → failed (on write error)
 *
 * awaiting_approval → {previous_state} (on approval granted)
 * awaiting_approval → cancelled (on approval rejected with user_cancelled)
 * awaiting_approval → paused (on approval rejected with needs_edit)
 * awaiting_approval → failed (on approval rejected with policy_violation)
 * awaiting_approval → timeout (on approval timeout)
 *
 * paused → {previous_state} (on user resume)
 * paused → cancelled (on user cancel)
 *
 * Any state → cancelled (on user cancel)
 * Any state → failed (on sandbox crash, network failure, etc.)
 */
export const RunState = z.enum([
  'pending',
  'initializing',
  'planning',
  'executing',
  'verifying',
  'packaging',
  'awaiting_approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'timeout',
])
export type RunState = z.infer<typeof RunState>

/**
 * Valid user actions per state:
 *
 * | State             | Valid Actions                        |
 * |-------------------|--------------------------------------|
 * | pending           | Cancel                               |
 * | initializing      | Cancel                               |
 * | planning          | Pause, Cancel                        |
 * | executing         | Pause, Cancel                        |
 * | verifying         | Pause, Cancel                        |
 * | packaging         | Cancel (with idempotency)            |
 * | awaiting_approval | Approve, Reject, Cancel              |
 * | paused            | Resume, Cancel                       |
 * | completed         | None                                 |
 * | failed            | Retry, View Logs                     |
 * | cancelled         | Retry                                |
 * | timeout           | Retry                                |
 */
export const UserAction = z.enum([
  'pause',
  'resume',
  'cancel',
  'approve',
  'reject',
  'retry',
])
export type UserAction = z.infer<typeof UserAction>

// Execution environment reference
export const ExecutionEnvSchema = z.object({
  sandbox_id: z.string(),
  template_id: z.string(),
  created_at: z.string().datetime(),
})
export type ExecutionEnv = z.infer<typeof ExecutionEnvSchema>

// Cost tracking
export const CostBreakdownSchema = z.object({
  compute_cents: z.number().int().nonnegative(),
  api_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
})
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>

// Artifact reference (points to ArtifactManifest)
export const ArtifactRefSchema = z.object({
  artifact_id: z.string(),
  type: z.string(),
  path: z.string(),
})
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>

// Run timestamps
export const RunTimestampsSchema = z.object({
  created_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
})
export type RunTimestamps = z.infer<typeof RunTimestampsSchema>

/**
 * Run - an instance of work.
 *
 * A run is an execution of a template against a task.
 * The contract snapshot is immutable once the run begins.
 */
export const RunSchema = z.object({
  // Identity
  run_id: z.string(),
  workspace_id: z.string(),

  // Template reference
  template_id: z.string(),
  template_version: z.string(),

  // Contract snapshot (immutable after run starts)
  contract: RunContractSchema,

  // Execution environment
  execution_env: ExecutionEnvSchema.nullable(),

  // State
  state: RunState,
  previous_state: RunState.nullable(), // For resuming from awaiting_approval/paused

  // Timestamps
  timestamps: RunTimestampsSchema,

  // Event stream reference
  event_stream_url: z.string().optional(),
  last_event_seq: z.number().int().nonnegative(),

  // Cost tracking
  cost: CostBreakdownSchema.nullable(),

  // Produced artifacts
  artifacts: z.array(ArtifactRefSchema),

  // Error info (if failed)
  error: z
    .object({
      type: z.string(),
      message: z.string(),
      recoverable: z.boolean(),
    })
    .nullable(),
})
export type Run = z.infer<typeof RunSchema>

// State transition validation
const VALID_TRANSITIONS: Record<RunState, RunState[]> = {
  pending: ['initializing', 'cancelled'],
  initializing: ['planning', 'failed', 'cancelled'],
  planning: ['executing', 'awaiting_approval', 'failed', 'paused', 'cancelled'],
  executing: ['verifying', 'awaiting_approval', 'failed', 'paused', 'cancelled'],
  verifying: ['packaging', 'executing', 'failed', 'paused', 'cancelled'],
  packaging: ['completed', 'failed', 'cancelled'],
  awaiting_approval: ['planning', 'executing', 'verifying', 'cancelled', 'paused', 'failed', 'timeout'],
  paused: ['planning', 'executing', 'verifying', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
  timeout: [],
}

export function isValidTransition(from: RunState, to: RunState): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function getValidTransitions(state: RunState): RunState[] {
  return VALID_TRANSITIONS[state]
}

// User action validation per state
const VALID_ACTIONS: Record<RunState, UserAction[]> = {
  pending: ['cancel'],
  initializing: ['cancel'],
  planning: ['pause', 'cancel'],
  executing: ['pause', 'cancel'],
  verifying: ['pause', 'cancel'],
  packaging: ['cancel'],
  awaiting_approval: ['approve', 'reject', 'cancel'],
  paused: ['resume', 'cancel'],
  completed: [],
  failed: ['retry'],
  cancelled: ['retry'],
  timeout: ['retry'],
}

export function isValidAction(state: RunState, action: UserAction): boolean {
  return VALID_ACTIONS[state].includes(action)
}

export function getValidActions(state: RunState): UserAction[] {
  return VALID_ACTIONS[state]
}

// Terminal states (run is done, no more transitions)
export function isTerminalState(state: RunState): boolean {
  return ['completed', 'failed', 'cancelled', 'timeout'].includes(state)
}

// Validation helpers
export function validateRun(data: unknown): Run {
  return RunSchema.parse(data)
}

export function isValidRun(data: unknown): data is Run {
  return RunSchema.safeParse(data).success
}
