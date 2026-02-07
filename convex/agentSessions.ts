import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { sessionState } from "./schema";

// =============================================================================
// Mutations
// =============================================================================

/**
 * Register a new agent session.
 *
 * Called when the orchestrator spawns a Claude Code tmux session.
 */
export const create = mutation({
  args: {
    runId: v.id("runs"),
    agentSlug: v.string(),
    tmuxSession: v.string(),
    pid: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sessionId = await ctx.db.insert("agentSessions", {
      runId: args.runId,
      agentSlug: args.agentSlug,
      tmuxSession: args.tmuxSession,
      pid: args.pid,
      state: "starting",
      startedAt: now,
      stoppedAt: null,
      exitCode: null,
      exitReason: null,
      lastHeartbeat: now,
    });

    return sessionId;
  },
});

/**
 * Update session state (e.g., starting -> running, running -> stopped).
 */
export const updateState = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    state: sessionState,
    exitCode: v.optional(v.number()),
    exitReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }

    const updates: Record<string, unknown> = {
      state: args.state,
    };

    if (args.state === "stopped" || args.state === "crashed") {
      updates.stoppedAt = Date.now();
    }
    if (args.exitCode !== undefined) {
      updates.exitCode = args.exitCode;
    }
    if (args.exitReason !== undefined) {
      updates.exitReason = args.exitReason;
    }

    await ctx.db.patch(args.sessionId, updates);
  },
});

/**
 * Record a heartbeat from a running session.
 *
 * The agent event bridge hook can call this periodically to
 * indicate the tmux session is still alive.
 */
export const heartbeat = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    pid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }

    const updates: Record<string, unknown> = {
      lastHeartbeat: Date.now(),
    };

    // Update PID if it was null before (process started after session created)
    if (args.pid !== undefined && session.pid === null) {
      updates.pid = args.pid;
    }

    // Auto-transition from starting to running on first heartbeat
    if (session.state === "starting") {
      updates.state = "running";
    }

    await ctx.db.patch(args.sessionId, updates);
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Get session for a specific run.
 */
export const getByRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .first();
  },
});

/**
 * List all sessions in a given state.
 */
export const listByState = query({
  args: {
    state: sessionState,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * List sessions for a specific agent type.
 */
export const listByAgent = query({
  args: {
    agentSlug: v.string(),
    state: v.optional(sessionState),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("agentSessions")
      .withIndex("by_agent", (idx) => {
        const base = idx.eq("agentSlug", args.agentSlug);
        return args.state ? base.eq("state", args.state) : base;
      });

    return await q.order("desc").take(args.limit ?? 50);
  },
});

/**
 * Find stale sessions (no heartbeat in the last N milliseconds).
 *
 * Used by a health check cron to detect crashed sessions.
 */
export const findStale = query({
  args: {
    staleThresholdMs: v.optional(v.number()), // Default: 60 seconds
  },
  handler: async (ctx, args) => {
    const threshold = args.staleThresholdMs ?? 60_000;
    const cutoff = Date.now() - threshold;

    // Get all running sessions
    const running = await ctx.db
      .query("agentSessions")
      .withIndex("by_state", (q) => q.eq("state", "running"))
      .collect();

    // Filter those with stale heartbeats
    return running.filter(
      (s) => s.lastHeartbeat !== null && s.lastHeartbeat < cutoff,
    );
  },
});
