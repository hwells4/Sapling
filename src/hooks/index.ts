// React hooks for Sapling OS

// Convex-powered hooks (primary — use these)
export {
  useConvexRun,
  useKanbanBoard,
  useApprovalCount,
  useLatestEvents,
  type UseConvexRunResult,
  type PendingApproval,
  type RunId,
  type RunDoc,
  type EventDoc,
  type ApprovalDoc,
} from './useConvexRun'

// Legacy SSE hooks (kept for reference, will be removed)
export {
  useEventStream,
  type UseEventStreamOptions,
  type UseEventStreamResult,
  type EventStreamState,
} from './useEventStream'

export {
  useRun,
  type UseRunOptions,
  type UseRunResult,
} from './useRun'
