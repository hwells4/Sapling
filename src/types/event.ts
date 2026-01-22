import { z } from 'zod'

// Run phases - orchestrator controls phase transitions
export const Phase = z.enum([
  'pending',
  'planning',
  'executing',
  'verifying',
  'packaging',
  'completed',
  'failed',
])
export type Phase = z.infer<typeof Phase>

// Event severity levels
export const Severity = z.enum(['info', 'warning', 'error'])
export type Severity = z.infer<typeof Severity>

// All event types - discriminated by `type` field
export const EventType = z.enum([
  'run.started',
  'phase.changed',
  'tool.called',
  'tool.result',
  'file.changed',
  'artifact.created',
  'checkpoint.requested',
  'checkpoint.approved',
  'checkpoint.rejected',
  'checkpoint.timeout',
  'drift.detected',
  'run.completed',
  'run.failed',
])
export type EventType = z.infer<typeof EventType>

// Payload type definitions for each event type
export const RunStartedPayload = z.object({
  contract_id: z.string(),
  template_id: z.string(),
  template_version: z.string(),
  goal: z.string(),
})
export type RunStartedPayload = z.infer<typeof RunStartedPayload>

export const PhaseChangedPayload = z.object({
  from_phase: Phase.nullable(),
  to_phase: Phase,
  reason: z.string().optional(),
})
export type PhaseChangedPayload = z.infer<typeof PhaseChangedPayload>

export const ToolCalledPayload = z.object({
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  friendly_label: z.string().optional(), // e.g., "Checking GitHub issues"
})
export type ToolCalledPayload = z.infer<typeof ToolCalledPayload>

export const ToolResultPayload = z.object({
  tool_name: z.string(),
  success: z.boolean(),
  output_summary: z.string().optional(),
  error: z.string().optional(),
  duration_ms: z.number().int().nonnegative(),
})
export type ToolResultPayload = z.infer<typeof ToolResultPayload>

export const FileChangedPayload = z.object({
  path: z.string(),
  operation: z.enum(['created', 'modified', 'deleted']),
  size_bytes: z.number().int().nonnegative().optional(),
})
export type FileChangedPayload = z.infer<typeof FileChangedPayload>

export const ArtifactCreatedPayload = z.object({
  artifact_id: z.string(),
  type: z.string(),
  destination_path: z.string(),
  preview_type: z.string().optional(),
})
export type ArtifactCreatedPayload = z.infer<typeof ArtifactCreatedPayload>

export const CheckpointRequestedPayload = z.object({
  checkpoint_id: z.string(),
  action_type: z.string(), // e.g., 'send_email', 'create_pr'
  preview: z.record(z.unknown()),
  timeout_seconds: z.number().int().positive(),
})
export type CheckpointRequestedPayload = z.infer<typeof CheckpointRequestedPayload>

export const CheckpointApprovedPayload = z.object({
  checkpoint_id: z.string(),
  approver_id: z.string(),
  approved_from: z.enum(['web', 'desktop', 'mobile', 'api']),
})
export type CheckpointApprovedPayload = z.infer<typeof CheckpointApprovedPayload>

export const CheckpointRejectedPayload = z.object({
  checkpoint_id: z.string(),
  reason: z.enum(['user_cancelled', 'needs_edit', 'policy_violation']),
  rejector_id: z.string().optional(),
})
export type CheckpointRejectedPayload = z.infer<typeof CheckpointRejectedPayload>

export const CheckpointTimeoutPayload = z.object({
  checkpoint_id: z.string(),
  auto_action: z.enum(['approve', 'reject']),
})
export type CheckpointTimeoutPayload = z.infer<typeof CheckpointTimeoutPayload>

export const DriftDetectedPayload = z.object({
  drift_type: z.enum(['unauthorized_tool', 'path_violation', 'loop_detected', 'constraint_breach']),
  details: z.string(),
  tool_name: z.string().optional(),
  path: z.string().optional(),
})
export type DriftDetectedPayload = z.infer<typeof DriftDetectedPayload>

export const RunCompletedPayload = z.object({
  outcome_summary: z.string(),
  artifacts_produced: z.number().int().nonnegative(),
  cost_cents: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().nonnegative(),
})
export type RunCompletedPayload = z.infer<typeof RunCompletedPayload>

export const RunFailedPayload = z.object({
  error_type: z.string(),
  error_message: z.string(),
  recoverable: z.boolean(),
  checkpoint_available: z.boolean(),
})
export type RunFailedPayload = z.infer<typeof RunFailedPayload>

// Union of all payload types for type inference
export type EventPayload =
  | RunStartedPayload
  | PhaseChangedPayload
  | ToolCalledPayload
  | ToolResultPayload
  | FileChangedPayload
  | ArtifactCreatedPayload
  | CheckpointRequestedPayload
  | CheckpointApprovedPayload
  | CheckpointRejectedPayload
  | CheckpointTimeoutPayload
  | DriftDetectedPayload
  | RunCompletedPayload
  | RunFailedPayload

/**
 * Event envelope - the atomic unit of observability.
 *
 * Events are append-only and ordered by `seq` within a run.
 * The `seq` field enables:
 * - Reconnection: UI can request events after a seq cursor
 * - Replay: Events can be replayed in order for testing
 * - Ordering: Events are guaranteed to be ordered within a run
 *
 * Example reconnection: GET /runs/{run_id}/events?after_seq=42
 */
export const EventSchema = z.object({
  event_id: z.string().uuid(),
  run_id: z.string(),
  seq: z.number().int().nonnegative(), // Monotonic per run - critical for replay
  ts: z.string().datetime(), // ISO 8601 UTC
  type: EventType,
  phase: Phase,
  severity: Severity,
  payload: z.record(z.unknown()),
})
export type Event = z.infer<typeof EventSchema>

// Type-safe event creators
export function createEvent<T extends EventType>(
  base: Omit<Event, 'event_id' | 'ts'> & { type: T },
): Event {
  return {
    ...base,
    event_id: crypto.randomUUID(),
    ts: new Date().toISOString(),
  }
}

// Validation helpers
export function validateEvent(data: unknown): Event {
  return EventSchema.parse(data)
}

export function isValidEvent(data: unknown): data is Event {
  return EventSchema.safeParse(data).success
}
