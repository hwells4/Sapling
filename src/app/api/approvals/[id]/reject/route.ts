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

const RejectRequestSchema = z.object({
  reason: RejectionReason,
  rejector_id: z.string().optional(),
  source: ApprovalSource.optional().default('api'),
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/approvals/[id]/reject - Reject a pending checkpoint
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: checkpointId } = await params

    // Parse request body
    const body = await request.json()
    const parseResult = RejectRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { reason, rejector_id, source } = parseResult.data

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

    // Perform rejection
    const result = approvalService.reject(checkpointId, reason, rejector_id, source)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Get audit log for the checkpoint
    const auditLog = approvalService.getAuditLog(checkpointId)

    return NextResponse.json({
      checkpoint_id: checkpointId,
      status: result.status,
      reason,
      transition: result.transition,
      audit_log: auditLog,
    })
  } catch (error) {
    console.error('Error rejecting checkpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
