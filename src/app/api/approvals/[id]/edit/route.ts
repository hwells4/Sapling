import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createEventStore,
  createRunDB,
  createEventEmitter,
  createRunStateMachine,
  createApprovalService,
  ApprovalSource,
  RejectionReason,
} from '@/services'
import type { Run } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared infrastructure (would be singleton in production)
// ─────────────────────────────────────────────────────────────────────────────

const eventStore = createEventStore()
const runDB = createRunDB(eventStore)
const eventEmitter = createEventEmitter()
const stateMachine = createRunStateMachine()

// Run cache for approval service callbacks
const runCache = new Map<string, Run>()

const getRun = async (runId: string): Promise<Run | undefined> => {
  const cached = runCache.get(runId)
  if (cached) return cached

  const result = await runDB.getRun(runId)
  if (result.success && result.data) {
    runCache.set(runId, result.data)
    return result.data
  }
  return undefined
}

const updateRun = (runId: string, updates: Partial<Run>): void => {
  const existing = runCache.get(runId)
  if (existing) {
    runCache.set(runId, { ...existing, ...updates } as Run)
  }
}

// Sync wrapper for approval service (needs refactoring for async in production)
const getRunSync = (runId: string): Run | undefined => runCache.get(runId)

const approvalService = createApprovalService(eventEmitter, stateMachine, getRunSync, updateRun)

// ─────────────────────────────────────────────────────────────────────────────
// Request Schema
// ─────────────────────────────────────────────────────────────────────────────

const EditRequestSchema = z.object({
  editor_id: z.string().min(1),
  edited_preview: z.record(z.unknown()),
  source: ApprovalSource.optional().default('api'),
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/approvals/[id]/edit - Edit a pending checkpoint
//
// This route handles the "needs_edit" flow:
// 1. Rejects the current checkpoint with reason "needs_edit"
// 2. The orchestrator will receive the edited_preview and can re-request approval
//
// In a full implementation, the orchestrator would:
// - Receive the checkpoint.rejected event with needs_edit reason
// - Apply the edited_preview as modifications
// - Re-request approval with the updated action
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: checkpointId } = await params

    // Parse request body
    const body = await request.json()
    const parseResult = EditRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { editor_id, edited_preview, source } = parseResult.data

    // Get the pending approval to find the run_id
    const pending = approvalService.getPending(checkpointId)
    if (!pending) {
      return NextResponse.json(
        { error: `Checkpoint ${checkpointId} not found` },
        { status: 404 }
      )
    }

    // Ensure run is in cache for state machine transition
    await getRun(pending.run_id)

    // Reject with "needs_edit" reason - orchestrator will handle the edit
    const result = approvalService.reject(
      checkpointId,
      'needs_edit' as RejectionReason,
      editor_id,
      source
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Emit a custom event for the orchestrator with the edited preview
    // In production, this would be stored and picked up by the orchestrator
    eventEmitter.emit(
      pending.run_id,
      'checkpoint.edited' as any,
      {
        checkpoint_id: checkpointId,
        editor_id,
        original_preview: pending.preview,
        edited_preview,
        action_type: pending.action_type,
      },
      'awaiting_approval' as any,
      'info'
    )

    // Get audit log for the checkpoint
    const auditLog = approvalService.getAuditLog(checkpointId)

    return NextResponse.json({
      checkpoint_id: checkpointId,
      status: 'edited',
      original_preview: pending.preview,
      edited_preview,
      transition: result.transition,
      audit_log: auditLog,
    })
  } catch (error) {
    console.error('Error editing checkpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
