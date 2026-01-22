import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createEventStore,
  createRunDB,
  createEventEmitter,
  createRunStateMachine,
  createApprovalService,
  type PendingApproval,
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

const getRun = (runId: string): Run | undefined => {
  const cached = runCache.get(runId)
  if (cached) return cached

  // Try to fetch from runDB synchronously (not ideal, but needed for callback)
  // In production, this would be handled differently
  return undefined
}

const updateRun = (runId: string, updates: Partial<Run>): void => {
  const existing = runCache.get(runId)
  if (existing) {
    runCache.set(runId, { ...existing, ...updates } as Run)
  }
}

const approvalService = createApprovalService(eventEmitter, stateMachine, getRun, updateRun)

// ─────────────────────────────────────────────────────────────────────────────
// Request Schemas
// ─────────────────────────────────────────────────────────────────────────────

const ListApprovalsQuerySchema = z.object({
  run_id: z.string().optional(),
  action_type: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/approvals - List pending approvals
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const queryObj: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      queryObj[key] = value
    })

    const parseResult = ListApprovalsQuerySchema.safeParse(queryObj)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { run_id, action_type } = parseResult.data

    let pendingApprovals: PendingApproval[]

    if (run_id) {
      // Get pending approvals for a specific run
      pendingApprovals = approvalService.getPendingForRun(run_id)
    } else {
      // Get all pending approvals (optionally filtered by action type)
      pendingApprovals = approvalService.getAllPending(action_type)
    }

    return NextResponse.json({
      approvals: pendingApprovals,
      total: pendingApprovals.length,
    })
  } catch (error) {
    console.error('Error listing approvals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
