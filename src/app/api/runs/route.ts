import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { RunContractSchema, type RunContract, isValidContract } from '@/types'
import {
  createRunDB,
  createEventStore,
  createRunOrchestrator,
  createEventEmitter,
  createRunStateMachine,
  createApprovalService,
  createErrorHandler,
  createVaultWriter,
  createTraceWriter,
  createContractValidator,
  createCostTracker,
  createSandboxAdapter,
  type RunFilter,
  type RunPagination,
  type StartRunOptions,
  type OrchestratorDependencies,
} from '@/services'

// ─────────────────────────────────────────────────────────────────────────────
// Shared infrastructure (would be singleton in production)
// ─────────────────────────────────────────────────────────────────────────────

const eventStore = createEventStore()
const runDB = createRunDB(eventStore)

// ─────────────────────────────────────────────────────────────────────────────
// Request Schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateRunRequestSchema = z.object({
  workspace_id: z.string().min(1),
  template_id: z.string().min(1),
  template_version: z.string().min(1),
  contract: RunContractSchema,
  sandbox_template_id: z.string().optional(),
  timeout_ms: z.number().positive().optional(),
})

const ListRunsQuerySchema = z.object({
  workspace_id: z.string().optional(),
  template_id: z.string().optional(),
  states: z.string().optional(), // comma-separated list
  terminal_only: z.coerce.boolean().optional(),
  active_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  sort_by: z.enum(['created_at', 'updated_at']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/runs - Create and start a new run
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const parseResult = CreateRunRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { workspace_id, template_id, template_version, contract, sandbox_template_id, timeout_ms } =
      parseResult.data

    // Create orchestrator dependencies
    const eventEmitter = createEventEmitter()
    const stateMachine = createRunStateMachine()

    // Run cache for approval service callbacks
    const runCache = new Map<string, import('@/types').Run>()
    const getRun = (runId: string) => runCache.get(runId)
    const updateRun = (runId: string, updates: Partial<import('@/types').Run>) => {
      const existing = runCache.get(runId)
      if (existing) {
        runCache.set(runId, { ...existing, ...updates })
      }
    }

    const approvalService = createApprovalService(eventEmitter, stateMachine, getRun, updateRun)
    const errorHandler = createErrorHandler(eventEmitter, stateMachine)
    const contractValidator = createContractValidator()
    const costTracker = createCostTracker()
    const vaultWriter = createVaultWriter('brain')
    const traceWriter = createTraceWriter('brain/traces')

    const deps: OrchestratorDependencies = {
      eventEmitter,
      stateMachine,
      approvalService,
      errorHandler,
      runDB,
      vaultWriter,
      traceWriter,
      contractValidator,
      costTracker,
      createSandbox: (options) =>
        createSandboxAdapter({
          run_id: options.run_id,
          contract: options.contract,
          template_id: options.template_id,
          timeout_ms: options.timeout_ms,
        }),
    }

    const orchestrator = createRunOrchestrator(deps)

    // Start the run
    const startOptions: StartRunOptions = {
      workspace_id,
      template_id,
      template_version,
      contract,
      sandbox_template_id,
      timeout_ms,
    }

    const result = await orchestrator.start(startOptions)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      {
        run: result.data,
        event_stream_url: `/api/runs/${result.data!.run_id}/events`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs - List runs with pagination and filters
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const queryObj: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      queryObj[key] = value
    })

    const parseResult = ListRunsQuerySchema.safeParse(queryObj)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { workspace_id, template_id, states, terminal_only, active_only, limit, offset, sort_by, sort_order } =
      parseResult.data

    // Build filter
    const filter: RunFilter = {}
    if (workspace_id) filter.workspace_id = workspace_id
    if (template_id) filter.template_id = template_id
    if (states) {
      filter.states = states.split(',').map((s) => s.trim()) as RunFilter['states']
    }
    if (terminal_only) filter.terminal_only = terminal_only
    if (active_only) filter.active_only = active_only

    // Build pagination
    const pagination: RunPagination = {}
    if (limit !== undefined) pagination.limit = limit
    if (offset !== undefined) pagination.offset = offset
    if (sort_by) pagination.sort_by = sort_by
    if (sort_order) pagination.sort_order = sort_order

    // Query runs
    const result = await runDB.listRuns(filter, pagination)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      runs: result.data.runs,
      total: result.data.total,
      hasMore: result.data.hasMore,
      limit: pagination.limit ?? 50,
      offset: pagination.offset ?? 0,
    })
  } catch (error) {
    console.error('Error listing runs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
