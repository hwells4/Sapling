import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { approvalStatus, runState } from "./schema";

// =============================================================================
// Mutations
// =============================================================================

/**
 * Request approval for a checkpoint.
 *
 * Called by the run orchestrator when an agent hits an action that
 * requires human approval (per the contract's approval rules).
 * Creates an approval record in "pending" status and transitions
 * the run to "awaiting_approval".
 */
export const requestApproval = mutation({
  args: {
    runId: v.id("runs"),
    checkpointId: v.string(),
    actionType: v.string(),
    preview: v.any(),
    timeoutSeconds: v.number(),
    timeoutAction: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    // Validate run exists
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error(`Run not found: ${args.runId}`);
    }

    // Check for duplicate checkpoint
    const existing = await ctx.db
      .query("approvals")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .first();

    if (existing) {
      throw new Error(`Checkpoint already exists: ${args.checkpointId}`);
    }

    const now = Date.now();
    const expiresAt = now + args.timeoutSeconds * 1000;

    // Create the approval record
    const approvalId = await ctx.db.insert("approvals", {
      runId: args.runId,
      checkpointId: args.checkpointId,
      actionType: args.actionType,
      preview: args.preview,
      status: "pending",
      requestedFromPhase: run.state,
      createdAt: now,
      expiresAt,
      timeoutAction: args.timeoutAction,
      resolvedAt: null,
      resolvedBy: null,
      resolvedFrom: null,
      rejectionReason: null,
    });

    // Transition run to awaiting_approval
    await ctx.db.patch(args.runId, {
      state: "awaiting_approval",
      previousState: run.state,
      updatedAt: now,
    });

    return approvalId;
  },
});

/**
 * Approve a pending checkpoint.
 *
 * Resolves the approval and transitions the run back to its
 * previousState (the phase it was in before requesting approval).
 */
export const approve = mutation({
  args: {
    checkpointId: v.string(),
    approverId: v.string(),
    source: v.union(
      v.literal("web"),
      v.literal("desktop"),
      v.literal("mobile"),
      v.literal("api"),
      v.literal("bulk"),
    ),
  },
  handler: async (ctx, args) => {
    // Find the approval by checkpoint ID
    const approval = await ctx.db
      .query("approvals")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .first();

    if (!approval) {
      throw new Error(`Checkpoint not found: ${args.checkpointId}`);
    }

    if (approval.status !== "pending") {
      throw new Error(
        `Checkpoint ${args.checkpointId} already ${approval.status}`,
      );
    }

    const now = Date.now();

    // Resolve the approval
    await ctx.db.patch(approval._id, {
      status: "approved",
      resolvedAt: now,
      resolvedBy: args.approverId,
      resolvedFrom: args.source,
    });

    // Transition run back to previous state
    const run = await ctx.db.get(approval.runId);
    if (run && run.state === "awaiting_approval" && run.previousState) {
      await ctx.db.patch(approval.runId, {
        state: run.previousState,
        previousState: "awaiting_approval",
        updatedAt: now,
      });
    }

    return { status: "approved", runId: approval.runId };
  },
});

/**
 * Reject a pending checkpoint.
 *
 * Resolves the approval as rejected. The run transitions based on
 * the rejection reason:
 *   - user_cancelled -> cancelled
 *   - needs_edit -> paused
 *   - policy_violation -> failed
 */
export const reject = mutation({
  args: {
    checkpointId: v.string(),
    reason: v.union(
      v.literal("user_cancelled"),
      v.literal("needs_edit"),
      v.literal("policy_violation"),
    ),
    rejectorId: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("web"),
        v.literal("desktop"),
        v.literal("mobile"),
        v.literal("api"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db
      .query("approvals")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .first();

    if (!approval) {
      throw new Error(`Checkpoint not found: ${args.checkpointId}`);
    }

    if (approval.status !== "pending") {
      throw new Error(
        `Checkpoint ${args.checkpointId} already ${approval.status}`,
      );
    }

    const now = Date.now();

    // Resolve the approval
    await ctx.db.patch(approval._id, {
      status: "rejected",
      resolvedAt: now,
      resolvedBy: args.rejectorId ?? null,
      resolvedFrom: args.source ?? "web",
      rejectionReason: args.reason,
    });

    // Determine target state based on rejection reason
    const stateMap: Record<string, string> = {
      user_cancelled: "cancelled",
      needs_edit: "paused",
      policy_violation: "failed",
    };
    const targetState = stateMap[args.reason] ?? "failed";

    // Transition run
    const run = await ctx.db.get(approval.runId);
    if (run && run.state === "awaiting_approval") {
      const updates: Record<string, unknown> = {
        state: targetState,
        previousState: "awaiting_approval",
        updatedAt: now,
      };

      if (targetState === "failed") {
        updates.error = {
          type: "approval_rejected",
          message: `Checkpoint rejected: ${args.reason}`,
          recoverable: args.reason === "needs_edit",
        };
        updates.completedAt = now;
      }
      if (targetState === "cancelled") {
        updates.completedAt = now;
      }

      await ctx.db.patch(approval.runId, updates);
    }

    return { status: "rejected", reason: args.reason, runId: approval.runId };
  },
});

/**
 * Process timed-out approvals.
 *
 * This should be called periodically (e.g., via a Convex cron job).
 * Finds all pending approvals past their expiry and resolves them
 * according to their configured timeoutAction.
 */
export const processTimeouts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired pending approvals using the by_expiry index
    const expired = await ctx.db
      .query("approvals")
      .withIndex("by_expiry", (q) =>
        q.eq("status", "pending").lt("expiresAt", now),
      )
      .collect();

    const results = [];

    for (const approval of expired) {
      if (approval.timeoutAction === "approve") {
        // Auto-approve
        await ctx.db.patch(approval._id, {
          status: "approved",
          resolvedAt: now,
          resolvedBy: "system",
          resolvedFrom: "timeout",
        });

        // Resume run
        const run = await ctx.db.get(approval.runId);
        if (run && run.state === "awaiting_approval" && run.previousState) {
          await ctx.db.patch(approval.runId, {
            state: run.previousState,
            previousState: "awaiting_approval",
            updatedAt: now,
          });
        }

        results.push({
          checkpointId: approval.checkpointId,
          action: "approved",
        });
      } else {
        // Auto-reject (timeout state)
        await ctx.db.patch(approval._id, {
          status: "timeout",
          resolvedAt: now,
          resolvedBy: "system",
          resolvedFrom: "timeout",
        });

        // Transition run to timeout
        const run = await ctx.db.get(approval.runId);
        if (run && run.state === "awaiting_approval") {
          await ctx.db.patch(approval.runId, {
            state: "timeout",
            previousState: "awaiting_approval",
            completedAt: now,
            updatedAt: now,
          });
        }

        results.push({
          checkpointId: approval.checkpointId,
          action: "timeout",
        });
      }
    }

    return results;
  },
});

// =============================================================================
// Queries
// =============================================================================

/**
 * Get a specific approval by checkpoint ID.
 */
export const getByCheckpoint = query({
  args: { checkpointId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_checkpoint", (q) =>
        q.eq("checkpointId", args.checkpointId),
      )
      .first();
  },
});

/**
 * List approvals for a run (ordered by creation, newest first).
 */
export const listByRun = query({
  args: {
    runId: v.id("runs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * List all pending approvals (the approval queue).
 *
 * Powers the "Needs Human" section of the mission control UI.
 * Ordered by creation time so the oldest requests are shown first.
 */
export const listPending = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit ?? 50);
  },
});

/**
 * Count pending approvals (for badge/notification count).
 */
export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("approvals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.length;
  },
});
