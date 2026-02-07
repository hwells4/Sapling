'use client'

import { useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id, Doc } from '../../convex/_generated/dataModel'
import type { UserAction, Phase, ArtifactRef } from '../types'
import { getValidActions, isTerminalState } from '../types'

// Re-export Convex types for convenience
export type RunId = Id<'runs'>
export type RunDoc = Doc<'runs'>
export type EventDoc = Doc<'events'>
export type ApprovalDoc = Doc<'approvals'>

/**
 * Pending approval derived from the approvals table
 */
export interface PendingApproval {
  _id: Id<'approvals'>
  checkpointId: string
  actionType: string
  preview: unknown
  timeoutSeconds: number
  createdAt: number
  expiresAt: number
}

/**
 * Return type for useConvexRun
 */
export interface UseConvexRunResult {
  /** Run document (null while loading or if not found) */
  run: RunDoc | null | undefined
  /** Events for this run */
  events: EventDoc[] | undefined
  /** Pending approvals for this run */
  pendingApprovals: ApprovalDoc[] | undefined
  /** Current phase derived from run state */
  currentPhase: Phase | null
  /** Artifacts produced by the run */
  artifacts: ArtifactRef[]
  /** Valid user actions for the current state */
  validActions: UserAction[]
  /** Whether the run is in a terminal state */
  isTerminal: boolean
  /** Whether initial data is still loading */
  isLoading: boolean
  /** Transition run to a new state */
  transitionState: (newState: string, error?: { type: string; message: string; recoverable: boolean }) => Promise<void>
  /** Cancel the run */
  cancel: () => Promise<void>
}

/**
 * Convex-powered hook for run state management.
 *
 * Replaces the old useRun (REST + SSE) with pure Convex queries.
 * All data is real-time via WebSocket — no SSE, no polling, no reconnection logic.
 *
 * @example
 * ```tsx
 * const { run, events, pendingApprovals, cancel } = useConvexRun(runId)
 * ```
 */
export function useConvexRun(runId: RunId | null): UseConvexRunResult {
  // All three queries auto-subscribe via WebSocket.
  // Pass "skip" to disable subscription when no runId.
  const run = useQuery(api.runs.get, runId ? { runId } : 'skip')
  const eventsResult = useQuery(api.events.listByRun, runId ? { runId } : 'skip')
  const pendingApprovals = useQuery(
    api.approvals.listByRun,
    runId ? { runId } : 'skip',
  )

  const events = eventsResult?.events

  // Mutation handles
  const doTransition = useMutation(api.runs.transitionState)

  // Derive current phase from run state
  const currentPhase = useMemo((): Phase | null => {
    if (!run) return null
    return run.state as Phase
  }, [run])

  // Derive artifacts from run document
  const artifacts = useMemo((): ArtifactRef[] => {
    if (!run?.artifacts) return []
    return run.artifacts.map((a) => ({
      artifact_id: a.artifactId,
      type: a.type,
      path: a.path,
    }))
  }, [run?.artifacts])

  // Derive valid actions
  const validActions = useMemo((): UserAction[] => {
    if (!run) return []
    return getValidActions(run.state)
  }, [run])

  // Terminal state check
  const isTerminal = useMemo((): boolean => {
    if (!run) return false
    return isTerminalState(run.state)
  }, [run])

  // Loading state: undefined means still loading
  const isLoading = run === undefined

  // Action: transition state
  const transitionState = async (
    newState: string,
    error?: { type: string; message: string; recoverable: boolean },
  ) => {
    if (!runId) throw new Error('No run ID')
    await doTransition({ runId, newState: newState as any, error })
  }

  // Action: cancel
  const cancel = async () => {
    if (!runId) throw new Error('No run ID')
    await doTransition({
      runId,
      newState: 'cancelled' as any,
    })
  }

  return {
    run: run ?? null,
    events,
    pendingApprovals: pendingApprovals ?? undefined,
    currentPhase,
    artifacts,
    validActions,
    isTerminal,
    isLoading,
    transitionState,
    cancel,
  }
}

/**
 * Hook for the Kanban board view.
 *
 * Returns runs grouped by column, auto-updating in real-time.
 */
export function useKanbanBoard(workspaceId: string) {
  return useQuery(api.runs.kanbanBoard, { workspaceId })
}

/**
 * Hook for the pending approval count (badge number).
 */
export function useApprovalCount() {
  return useQuery(api.approvals.countPending)
}

/**
 * Hook for the latest events for a run (Kanban card preview).
 */
export function useLatestEvents(runId: RunId | null, limit = 3) {
  return useQuery(
    api.events.latestForRun,
    runId ? { runId, limit } : 'skip',
  )
}
