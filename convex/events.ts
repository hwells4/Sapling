import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { eventType, severity, runState } from "./schema";

// =============================================================================
// Mutations
// =============================================================================

/**
 * Append a single event to a run's event log.
 *
 * This is the primary ingestion path. The event bridge hook in each agent
 * calls this via the Sapling API to record tool calls, phase changes, etc.
 *
 * The sequence number is validated: it must equal lastEventSeq + 1 on the
 * run, ensuring strict ordering and gap detection.
 */
export const append = mutation({
  args: {
    runId: v.id("runs"),
    seq: v.number(),
    type: eventType,
    phase: runState,
    severity: severity,
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // Validate run exists
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    // Validate sequence ordering
    const expectedSeq = run.lastEventSeq + 1;
    if (args.seq !== expectedSeq) {
      throw new Error(
        `Sequence gap: expected ${expectedSeq}, got ${args.seq}. ` +
          `Run ${args.runId} lastEventSeq=${run.lastEventSeq}`,
      );
    }

    const now = Date.now();

    // Insert the event
    const eventId = await ctx.db.insert("events", {
      runId: args.runId,
      seq: args.seq,
      type: args.type,
      phase: args.phase,
      severity: args.severity,
      payload: args.payload,
      ts: now,
    });

    // Update the run's last event seq and timestamp
    await ctx.db.patch(args.runId, {
      lastEventSeq: args.seq,
      updatedAt: now,
    });

    return eventId;
  },
});

/**
 * Append a batch of events atomically.
 *
 * All events must be for the same run and in consecutive seq order.
 * This is more efficient than individual appends when the agent hook
 * buffers multiple events.
 *
 * Convex mutations are transactional: either all events are written
 * or none are.
 */
export const appendBatch = mutation({
  args: {
    runId: v.id("runs"),
    events: v.array(
      v.object({
        seq: v.number(),
        type: eventType,
        phase: runState,
        severity: severity,
        payload: v.any(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.events.length === 0) return [];

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    // Validate sequence ordering
    let expectedSeq = run.lastEventSeq + 1;
    for (let i = 0; i < args.events.length; i++) {
      if (args.events[i].seq !== expectedSeq) {
        throw new Error(
          `Sequence gap at index ${i}: expected ${expectedSeq}, got ${args.events[i].seq}`,
        );
      }
      expectedSeq++;
    }

    const now = Date.now();
    const eventIds = [];

    // Insert all events
    for (const event of args.events) {
      const eventId = await ctx.db.insert("events", {
        runId: args.runId,
        seq: event.seq,
        type: event.type,
        phase: event.phase,
        severity: event.severity,
        payload: event.payload,
        ts: now,
      });
      eventIds.push(eventId);
    }

    // Update run's last event seq
    const lastSeq = args.events[args.events.length - 1].seq;
    await ctx.db.patch(args.runId, {
      lastEventSeq: lastSeq,
      updatedAt: now,
    });

    return eventIds;
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Get events for a run, ordered by sequence number.
 *
 * Supports cursor-based pagination via `afterSeq`: pass the seq of the
 * last event you received to get subsequent events. This is the pattern
 * used by the SSE event stream for reconnection.
 *
 * Example: GET /runs/{id}/events?after_seq=42
 */
export const listByRun = query({
  args: {
    runId: v.id("runs"),
    afterSeq: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const afterSeq = args.afterSeq ?? -1;

    const events = await ctx.db
      .query("events")
      .withIndex("by_run_seq", (q) =>
        q.eq("runId", args.runId).gt("seq", afterSeq),
      )
      .order("asc")
      .take(limit + 1); // Fetch one extra to check hasMore

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    return {
      events: page,
      hasMore,
      nextCursor:
        page.length > 0 ? page[page.length - 1].seq : undefined,
    };
  },
});

/**
 * Get events for a run filtered by type.
 *
 * Useful for showing only tool calls in the inspector, or only
 * phase changes in a timeline view.
 */
export const listByRunAndType = query({
  args: {
    runId: v.id("runs"),
    type: eventType,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("events")
      .withIndex("by_run_type", (q) =>
        q.eq("runId", args.runId).eq("type", args.type),
      )
      .order("asc")
      .take(limit);
  },
});

/**
 * Get the latest N events for a run (most recent first).
 *
 * Powers the "last 3 events" preview on Kanban cards.
 */
export const latestForRun = query({
  args: {
    runId: v.id("runs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3;

    return await ctx.db
      .query("events")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Count events by type for a run (for statistics/summary).
 */
export const countByType = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId))
      .collect();

    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }

    return {
      total: events.length,
      byType: counts,
      lastSeq: events.length > 0 ? events[events.length - 1].seq : -1,
    };
  },
});
