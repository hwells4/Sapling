import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// =============================================================================
// Shared Validators (reusable across tables)
// =============================================================================

/**
 * Run lifecycle states.
 *
 * State machine:
 *   pending -> initializing -> planning -> executing -> verifying -> packaging -> completed
 *   Any active state -> failed | cancelled
 *   planning|executing -> awaiting_approval -> {resume to previous}
 *   planning|executing -> paused -> {resume to previous} | cancelled
 *   awaiting_approval -> timeout
 */
export const runState = v.union(
  v.literal("pending"),
  v.literal("initializing"),
  v.literal("planning"),
  v.literal("executing"),
  v.literal("verifying"),
  v.literal("packaging"),
  v.literal("awaiting_approval"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("timeout"),
);

/** Event types emitted during a run. */
export const eventType = v.union(
  v.literal("run.started"),
  v.literal("phase.changed"),
  v.literal("tool.called"),
  v.literal("tool.result"),
  v.literal("file.changed"),
  v.literal("artifact.created"),
  v.literal("checkpoint.requested"),
  v.literal("checkpoint.approved"),
  v.literal("checkpoint.rejected"),
  v.literal("checkpoint.timeout"),
  v.literal("drift.detected"),
  v.literal("run.completed"),
  v.literal("run.failed"),
);

/** Event severity levels. */
export const severity = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
);

/** Approval checkpoint status. */
export const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("timeout"),
);

/** Agent session state. */
export const sessionState = v.union(
  v.literal("starting"),
  v.literal("running"),
  v.literal("stopped"),
  v.literal("crashed"),
);

// =============================================================================
// Schema Definition
// =============================================================================

export default defineSchema({
  // ---------------------------------------------------------------------------
  // RUNS - the core work unit
  // ---------------------------------------------------------------------------
  runs: defineTable({
    // Identity
    workspaceId: v.string(),
    templateId: v.string(),
    templateVersion: v.string(),

    // The immutable contract snapshot (goal, constraints, tool policy, etc.)
    // Stored as a nested object matching the RunContract Zod schema.
    contract: v.object({
      contractVersion: v.literal("1.0"),
      templateId: v.string(),
      templateVersion: v.string(),
      goal: v.string(),
      successCriteria: v.array(
        v.object({
          id: v.string(),
          description: v.string(),
          evidenceType: v.union(
            v.literal("file_exists"),
            v.literal("api_response"),
            v.literal("test_passed"),
            v.literal("manual_check"),
          ),
          evidenceSpec: v.optional(v.any()),
        }),
      ),
      deliverables: v.array(
        v.object({
          id: v.string(),
          type: v.string(),
          destination: v.string(),
          required: v.boolean(),
        }),
      ),
      constraints: v.array(
        v.object({
          id: v.string(),
          description: v.string(),
          ruleType: v.string(),
          ruleSpec: v.any(),
        }),
      ),
      toolPolicy: v.object({
        allowed: v.array(v.string()),
        blocked: v.array(v.string()),
      }),
      integrationScopes: v.array(
        v.object({
          system: v.string(),
          scope: v.string(),
          grantedAt: v.optional(v.string()),
        }),
      ),
      approvalRules: v.array(
        v.object({
          actionType: v.string(),
          condition: v.union(
            v.literal("always"),
            v.literal("first_time"),
            v.literal("if_external"),
            v.literal("never"),
          ),
          timeoutSeconds: v.number(),
          autoActionOnTimeout: v.union(
            v.literal("approve"),
            v.literal("reject"),
          ),
        }),
      ),
      maxDurationSeconds: v.number(),
      maxCostCents: v.optional(v.number()),
      inputFiles: v.array(v.string()),
      outputDestinations: v.array(
        v.object({
          deliverableId: v.string(),
          pathPattern: v.string(),
        }),
      ),
    }),

    // State machine
    state: runState,
    previousState: v.union(runState, v.null()),

    // Timestamps (milliseconds since epoch -- Convex convention)
    createdAt: v.number(),
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),

    // Cost tracking (cents)
    computeCents: v.number(),
    apiCents: v.number(),
    totalCents: v.number(),

    // Last event sequence number for this run
    lastEventSeq: v.number(),

    // Artifacts produced (array of references)
    artifacts: v.array(
      v.object({
        artifactId: v.string(),
        type: v.string(),
        path: v.string(),
      }),
    ),

    // Error info (null when no error)
    error: v.union(
      v.object({
        type: v.string(),
        message: v.string(),
        recoverable: v.boolean(),
      }),
      v.null(),
    ),
  })
    // Primary query pattern: list runs for a workspace, ordered by creation.
    .index("by_workspace", ["workspaceId", "createdAt"])
    // Kanban board: filter by state within a workspace.
    .index("by_workspace_state", ["workspaceId", "state"])
    // Filter by template to find all runs of a specific agent type.
    .index("by_template", ["templateId", "createdAt"])
    // Find active (non-terminal) runs updated recently.
    .index("by_state", ["state", "updatedAt"]),

  // ---------------------------------------------------------------------------
  // EVENTS - append-only event log per run
  // ---------------------------------------------------------------------------
  events: defineTable({
    runId: v.id("runs"),
    seq: v.number(), // Monotonically increasing per run
    type: eventType,
    phase: runState, // Phase at time of event emission
    severity: severity,
    payload: v.any(), // Type-specific JSON payload
    ts: v.number(), // Event timestamp (ms since epoch)
  })
    // Primary query: get events for a run, ordered by sequence.
    .index("by_run_seq", ["runId", "seq"])
    // Filter events by type within a run (e.g., only tool.called events).
    .index("by_run_type", ["runId", "type", "seq"])
    // Global event timeline (for admin/debugging).
    .index("by_timestamp", ["ts"]),

  // ---------------------------------------------------------------------------
  // APPROVALS - human-in-the-loop checkpoints
  // ---------------------------------------------------------------------------
  approvals: defineTable({
    runId: v.id("runs"),
    checkpointId: v.string(), // Stable ID from the agent

    // What action needs approval
    actionType: v.string(), // e.g., "send_email", "create_pr", "write_file"
    preview: v.any(), // JSON preview of the proposed action

    // Status lifecycle: pending -> approved | rejected | timeout
    status: approvalStatus,

    // Phase the run was in when approval was requested
    requestedFromPhase: runState,

    // Timing
    createdAt: v.number(),
    expiresAt: v.number(),

    // Timeout behavior
    timeoutAction: v.union(v.literal("approve"), v.literal("reject")),

    // Resolution (populated when status changes from pending)
    resolvedAt: v.union(v.number(), v.null()),
    resolvedBy: v.union(v.string(), v.null()), // User ID or "system" for timeout
    resolvedFrom: v.union(
      v.literal("web"),
      v.literal("desktop"),
      v.literal("mobile"),
      v.literal("api"),
      v.literal("timeout"),
      v.literal("bulk"),
      v.null(),
    ),
    rejectionReason: v.union(
      v.literal("user_cancelled"),
      v.literal("needs_edit"),
      v.literal("policy_violation"),
      v.null(),
    ),
  })
    // List pending approvals for a run.
    .index("by_run", ["runId", "createdAt"])
    // Find all pending approvals globally (for the approval queue).
    .index("by_status", ["status", "createdAt"])
    // Lookup by checkpoint ID (for resolve operations).
    .index("by_checkpoint", ["checkpointId"])
    // Find expiring approvals (for timeout processing).
    .index("by_expiry", ["status", "expiresAt"]),

  // ---------------------------------------------------------------------------
  // AGENT SESSIONS - tracks running agent processes (tmux sessions)
  // ---------------------------------------------------------------------------
  agentSessions: defineTable({
    runId: v.id("runs"),
    agentSlug: v.string(), // e.g., "email-assistant", "github-triage"
    tmuxSession: v.string(), // e.g., "sapling-run_abc123"
    pid: v.union(v.number(), v.null()),

    // Session lifecycle
    state: sessionState,
    startedAt: v.number(),
    stoppedAt: v.union(v.number(), v.null()),

    // Exit info
    exitCode: v.union(v.number(), v.null()),
    exitReason: v.union(v.string(), v.null()),

    // Heartbeat -- last time the session reported alive
    lastHeartbeat: v.union(v.number(), v.null()),
  })
    // Find session for a run.
    .index("by_run", ["runId"])
    // List all sessions in a given state (e.g., all running).
    .index("by_state", ["state", "startedAt"])
    // Find sessions by agent type.
    .index("by_agent", ["agentSlug", "state"]),
});
