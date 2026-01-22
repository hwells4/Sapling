import { NextRequest, NextResponse } from 'next/server'
import { createRunDB, createEventStore } from '@/services'

// ─────────────────────────────────────────────────────────────────────────────
// Shared infrastructure (would be singleton in production)
// ─────────────────────────────────────────────────────────────────────────────

const eventStore = createEventStore()
const runDB = createRunDB(eventStore)

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs/[id] - Get run details
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    const result = await runDB.getRun(id)

    if (!result.success) {
      // Check if it's a not found error
      if (result.error.includes('not found')) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      run: result.data,
      event_stream_url: `/api/runs/${id}/events`,
    })
  } catch (error) {
    console.error('Error getting run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
