import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEventStream, type UseEventStreamOptions } from './useEventStream'
import type {
  Run,
  RunState,
  UserAction,
  Event,
  Phase,
  ArtifactRef,
  CheckpointRequestedPayload,
} from '../types'
import { getValidActions, isTerminalState } from '../types'

/**
 * Pending approval derived from checkpoint.requested events
 */
export interface PendingApproval {
  checkpoint_id: string
  action_type: string
  preview: Record<string, unknown>
  timeout_seconds: number
  requested_at: string
}

/**
 * Configuration options for the useRun hook
 */
export interface UseRunOptions {
  /** Base URL for API calls (defaults to window.location.origin) */
  baseUrl?: string
  /** Event stream options passed to useEventStream */
  streamOptions?: Omit<UseEventStreamOptions, 'baseUrl'>
  /** Called when run data is fetched or updated */
  onRunChange?: (run: Run | null) => void
  /** Called when current phase changes */
  onPhaseChange?: (phase: Phase | null) => void
  /** Called when a new approval is requested */
  onApprovalRequested?: (approval: PendingApproval) => void
}

/**
 * Return type for the useRun hook
 */
export interface UseRunResult {
  /** Current run data */
  run: Run | null
  /** Whether run data is loading */
  isLoading: boolean
  /** Error from fetching or actions */
  error: Error | null
  /** Current phase derived from events */
  currentPhase: Phase | null
  /** List of pending approvals */
  pendingApprovals: PendingApproval[]
  /** List of artifacts produced */
  artifacts: ArtifactRef[]
  /** Valid actions for current state */
  validActions: UserAction[]
  /** Whether run is in a terminal state */
  isTerminal: boolean
  /** Event stream connection state */
  streamState: ReturnType<typeof useEventStream>['state']
  /** All events from the stream */
  events: Event[]
  /** Refetch run data */
  refetch: () => Promise<void>
  /** Pause the run */
  pause: () => Promise<void>
  /** Resume the run */
  resume: () => Promise<void>
  /** Cancel the run */
  cancel: () => Promise<void>
}

/**
 * React hook for run state management
 *
 * Combines run data fetching, event streaming, and derived state computation.
 * Provides actions for pause/resume/cancel operations.
 *
 * @example
 * ```tsx
 * const {
 *   run,
 *   isLoading,
 *   currentPhase,
 *   pendingApprovals,
 *   artifacts,
 *   validActions,
 *   pause,
 *   resume,
 *   cancel,
 * } = useRun('run-123');
 *
 * if (isLoading) return <Loading />;
 * if (!run) return <NotFound />;
 *
 * return (
 *   <div>
 *     <PhaseIndicator phase={currentPhase} />
 *     {validActions.includes('pause') && <button onClick={pause}>Pause</button>}
 *     {pendingApprovals.length > 0 && <ApprovalPanel approvals={pendingApprovals} />}
 *     <ArtifactList artifacts={artifacts} />
 *   </div>
 * );
 * ```
 */
export function useRun(
  runId: string | null,
  options: UseRunOptions = {},
): UseRunResult {
  const { baseUrl, streamOptions, onRunChange, onPhaseChange, onApprovalRequested } = options

  // Run state
  const [run, setRun] = useState<Run | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Get base URL for API calls
  const apiBaseUrl = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')

  // Subscribe to event stream
  const eventStream = useEventStream(runId, {
    baseUrl: apiBaseUrl,
    ...streamOptions,
  })

  // Derive current phase from events
  const currentPhase = useMemo((): Phase | null => {
    if (eventStream.events.length === 0) {
      return run?.state as Phase | null
    }

    // Find the most recent phase.changed event
    for (let i = eventStream.events.length - 1; i >= 0; i--) {
      const event = eventStream.events[i]
      if (event.type === 'phase.changed') {
        const payload = event.payload as { to_phase: Phase }
        return payload.to_phase
      }
    }

    // Fall back to event phase or run state
    const lastEvent = eventStream.events[eventStream.events.length - 1]
    return lastEvent?.phase ?? (run?.state as Phase | null)
  }, [eventStream.events, run?.state])

  // Derive pending approvals from events
  const pendingApprovals = useMemo((): PendingApproval[] => {
    const requested = new Map<string, PendingApproval>()
    const resolved = new Set<string>()

    for (const event of eventStream.events) {
      if (event.type === 'checkpoint.requested') {
        const payload = event.payload as CheckpointRequestedPayload
        requested.set(payload.checkpoint_id, {
          checkpoint_id: payload.checkpoint_id,
          action_type: payload.action_type,
          preview: payload.preview,
          timeout_seconds: payload.timeout_seconds,
          requested_at: event.ts,
        })
      } else if (
        event.type === 'checkpoint.approved' ||
        event.type === 'checkpoint.rejected' ||
        event.type === 'checkpoint.timeout'
      ) {
        const payload = event.payload as { checkpoint_id: string }
        resolved.add(payload.checkpoint_id)
      }
    }

    // Return approvals that haven't been resolved
    return Array.from(requested.values()).filter(
      (a) => !resolved.has(a.checkpoint_id),
    )
  }, [eventStream.events])

  // Derive artifacts from events
  const artifacts = useMemo((): ArtifactRef[] => {
    const artifactList: ArtifactRef[] = []

    for (const event of eventStream.events) {
      if (event.type === 'artifact.created') {
        const payload = event.payload as {
          artifact_id: string
          type: string
          destination_path: string
        }
        artifactList.push({
          artifact_id: payload.artifact_id,
          type: payload.type,
          path: payload.destination_path,
        })
      }
    }

    // Merge with run.artifacts (run artifacts are the source of truth after completion)
    if (run?.artifacts) {
      const seen = new Set(artifactList.map((a) => a.artifact_id))
      for (const artifact of run.artifacts) {
        if (!seen.has(artifact.artifact_id)) {
          artifactList.push(artifact)
        }
      }
    }

    return artifactList
  }, [eventStream.events, run?.artifacts])

  // Derive valid actions from current state
  const validActions = useMemo((): UserAction[] => {
    const state = run?.state
    if (!state) return []
    return getValidActions(state)
  }, [run?.state])

  // Check if run is in terminal state
  const isTerminal = useMemo((): boolean => {
    const state = run?.state
    if (!state) return false
    return isTerminalState(state)
  }, [run?.state])

  // Fetch run data
  const fetchRun = useCallback(async () => {
    if (!runId) {
      setRun(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs/${runId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Run not found')
        }
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      const data = await response.json()
      setRun(data.run)
      onRunChange?.(data.run)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch run')
      setError(error)
      setRun(null)
      onRunChange?.(null)
    } finally {
      setIsLoading(false)
    }
  }, [runId, apiBaseUrl, onRunChange])

  // Update run state from phase.changed events
  useEffect(() => {
    if (!run) return

    // Find the latest phase.changed event
    for (let i = eventStream.events.length - 1; i >= 0; i--) {
      const event = eventStream.events[i]
      if (event.type === 'phase.changed') {
        const payload = event.payload as { to_phase: Phase }
        // Update run state if it changed
        if (run.state !== payload.to_phase) {
          setRun((prev) =>
            prev
              ? {
                  ...prev,
                  state: payload.to_phase as RunState,
                  previous_state: run.state,
                }
              : null,
          )
        }
        break
      }
    }
  }, [eventStream.events, run])

  // Notify on phase changes
  useEffect(() => {
    onPhaseChange?.(currentPhase)
  }, [currentPhase, onPhaseChange])

  // Notify on new approval requests
  useEffect(() => {
    if (!onApprovalRequested) return

    const lastEvent = eventStream.events[eventStream.events.length - 1]
    if (lastEvent?.type === 'checkpoint.requested') {
      const payload = lastEvent.payload as CheckpointRequestedPayload
      onApprovalRequested({
        checkpoint_id: payload.checkpoint_id,
        action_type: payload.action_type,
        preview: payload.preview,
        timeout_seconds: payload.timeout_seconds,
        requested_at: lastEvent.ts,
      })
    }
  }, [eventStream.events, onApprovalRequested])

  // Auto-fetch on runId change
  useEffect(() => {
    fetchRun()
  }, [fetchRun])

  // Run action helper
  const runAction = useCallback(
    async (action: 'pause' | 'resume' | 'cancel') => {
      if (!runId) {
        throw new Error('No run ID')
      }

      setError(null)

      try {
        const response = await fetch(`${apiBaseUrl}/api/runs/${runId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error ?? `Failed to ${action} run`)
        }

        // Refetch run to get updated state
        await fetchRun()
      } catch (err) {
        const error = err instanceof Error ? err : new Error(`Failed to ${action} run`)
        setError(error)
        throw error
      }
    },
    [runId, apiBaseUrl, fetchRun],
  )

  // Action handlers
  const pause = useCallback(() => runAction('pause'), [runAction])
  const resume = useCallback(() => runAction('resume'), [runAction])
  const cancel = useCallback(() => runAction('cancel'), [runAction])

  return {
    run,
    isLoading,
    error,
    currentPhase,
    pendingApprovals,
    artifacts,
    validActions,
    isTerminal,
    streamState: eventStream.state,
    events: eventStream.events,
    refetch: fetchRun,
    pause,
    resume,
    cancel,
  }
}
