import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createRunDB,
  createEventStore,
  createRunStateMachine,
} from '@/services'

// ─────────────────────────────────────────────────────────────────────────────
// Shared infrastructure (would be singleton in production)
// ─────────────────────────────────────────────────────────────────────────────

const eventStore = createEventStore()
const runDB = createRunDB(eventStore)
const stateMachine = createRunStateMachine()

// ─────────────────────────────────────────────────────────────────────────────
// Request Schema
// ─────────────────────────────────────────────────────────────────────────────

const PauseRequestSchema = z.object({
  actor_id: z.string().optional(),
  reason: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/runs/[id]/pause - Pause a running run
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    // Get the run first
    const runResult = await runDB.getRun(runId)
    if (!runResult.success) {
      if (runResult.error.includes('not found')) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }
      return NextResponse.json({ error: runResult.error }, { status: 500 })
    }

    // Parse optional body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine
    }

    const parseResult = PauseRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // Perform pause via state machine
    const pauseResult = stateMachine.performAction(runResult.data, { action: 'pause' })

    // Update run in database
    const updateResult = await runDB.updateRunState(runId, {
      state: pauseResult.newState,
      previous_state: pauseResult.previousState,
    })

    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error }, { status: 400 })
    }

    return NextResponse.json({
      run: updateResult.data,
      message: 'Run paused successfully',
    })
  } catch (error) {
    // Handle state machine errors
    if (error instanceof Error && error.message.includes('Cannot pause')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error pausing run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
