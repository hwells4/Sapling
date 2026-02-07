import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { runState } from "./schema";

// =============================================================================
// Valid state transitions (mirrors src/types/run.ts VALID_TRANSITIONS)
// =============================================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["initializing", "cancelled"],
  initializing: ["planning", "failed", "cancelled"],
  planning: [
    "executing",
    "awaiting_approval",
    "failed",
    "paused",
    "cancelled",
  ],
  executing: [
    "verifying",
    "awaiting_approval",
    "failed",
    "paused",
    "cancelled",
  ],
  verifying: ["packaging", "executing", "failed", "paused", "cancelled"],
  packaging: ["completed", "failed", "cancelled"],
  awaiting_approval: [
    "planning",
    "executing",
    "verifying",
    "cancelled",
    "paused",
    "failed",
    "timeout",
  ],
  paused: ["planning", "executing", "verifying", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
  timeout: [],
};

const TERMINAL_STATES = ["completed", "failed", "cancelled", "timeout"];

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new run in "pending" state.
 *
 * Returns the new run's Convex document ID.
 */
export const createRun = mutation({
  args: {
    workspaceId: v.string(),
    templateId: v.string(),
    templateVersion: v.string(),
    contract: v.any(), // Validated at the API layer via Zod; stored as-is.
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const runId = await ctx.db.insert("runs", {
      workspaceId: args.workspaceId,
      templateId: args.templateId,
      templateVersion: args.templateVersion,
      contract: args.contract,
      state: "pending",
      previousState: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
      computeCents: 0,
      apiCents: 0,
      totalCents: 0,
      lastEventSeq: -1,
      artifacts: [],
      error: null,
    });

    return runId;
  },
});

/**
 * Transition a run to a new state.
 *
 * Validates the transition against the state machine. Automatically
 * sets `startedAt` on first move out of "pending" and `completedAt`
 * when entering a terminal state.
 */
export const transitionState = mutation({
  args: {
    runId: v.id("runs"),
    newState: runState,
    error: v.optional(
      v.object({
        type: v.string(),
        message: v.string(),
        recoverable: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[run.state] ?? [];
    if (!allowed.includes(args.newState)) {
      throw new Error(
        `Invalid transition: ${run.state} -> ${args.newState}. ` +
          `Allowed: [${allowed.join(", ")}]`,
      );
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      state: args.newState,
      previousState: run.state,
      updatedAt: now,
    };

    // Auto-set startedAt on first activation
    if (run.state === "pending" && args.newState === "initializing") {
      updates.startedAt = now;
    }

    // Auto-set completedAt on terminal states
    if (TERMINAL_STATES.includes(args.newState)) {
      updates.completedAt = now;
    }

    // Attach error info on failure
    if (args.error) {
      updates.error = args.error;
    } else if (args.newState !== "failed") {
      // Clear error when moving to a non-failed state
      updates.error = null;
    }

    await ctx.db.patch(args.runId, updates);
    return { previousState: run.state, newState: args.newState };
  },
});

/**
 * Update cost tracking for a run.
 *
 * Increments compute and API cents. Total is auto-computed.
 */
export const updateCost = mutation({
  args: {
    runId: v.id("runs"),
    addComputeCents: v.number(),
    addApiCents: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    const computeCents = run.computeCents + args.addComputeCents;
    const apiCents = run.apiCents + args.addApiCents;

    await ctx.db.patch(args.runId, {
      computeCents,
      apiCents,
      totalCents: computeCents + apiCents,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Add an artifact reference to a run.
 */
export const addArtifact = mutation({
  args: {
    runId: v.id("runs"),
    artifactId: v.string(),
    type: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    // Prevent duplicates
    if (run.artifacts.some((a) => a.artifactId === args.artifactId)) {
      throw new Error(`Artifact already exists: ${args.artifactId}`);
    }

    await ctx.db.patch(args.runId, {
      artifacts: [
        ...run.artifacts,
        {
          artifactId: args.artifactId,
          type: args.type,
          path: args.path,
        },
      ],
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Get a single run by ID.
 */
export const get = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

/**
 * List runs for a workspace, ordered by creation time (newest first).
 */
export const listByWorkspace = query({
  args: {
    workspaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("runs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get runs grouped by state for a Kanban board.
 *
 * Returns an object with state keys mapping to arrays of runs.
 * This powers the mission control Kanban view with five columns:
 *   Queue      -> pending
 *   Running    -> initializing, planning, executing, verifying, packaging
 *   Needs Human -> awaiting_approval, paused
 *   Done       -> completed
 *   Failed     -> failed, cancelled, timeout
 */
export const kanbanBoard = query({
  args: {
    workspaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    // Fetch all non-terminal runs plus recent terminal runs
    const allRuns = await ctx.db
      .query("runs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);

    // Group into Kanban columns
    const board = {
      queue: [] as typeof allRuns,
      running: [] as typeof allRuns,
      needsHuman: [] as typeof allRuns,
      done: [] as typeof allRuns,
      failed: [] as typeof allRuns,
    };

    for (const run of allRuns) {
      switch (run.state) {
        case "pending":
          board.queue.push(run);
          break;
        case "initializing":
        case "planning":
        case "executing":
        case "verifying":
        case "packaging":
          board.running.push(run);
          break;
        case "awaiting_approval":
        case "paused":
          board.needsHuman.push(run);
          break;
        case "completed":
          board.done.push(run);
          break;
        case "failed":
        case "cancelled":
        case "timeout":
          board.failed.push(run);
          break;
      }
    }

    return board;
  },
});

/**
 * List runs in a specific state (useful for worker polling).
 *
 * Example: find all "pending" runs to pick up.
 */
export const listByState = query({
  args: {
    state: runState,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("runs")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .order("desc")
      .take(limit);
  },
});

/**
 * Count runs by state for a workspace (Kanban column counts).
 */
export const countByState = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    const allRuns = await ctx.db
      .query("runs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const counts: Record<string, number> = {};
    for (const run of allRuns) {
      counts[run.state] = (counts[run.state] ?? 0) + 1;
    }
    return counts;
  },
});
