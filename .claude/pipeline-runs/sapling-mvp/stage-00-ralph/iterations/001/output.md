Completed **Sapling-370: Implement useEventStream hook**.

Created `src/hooks/useEventStream.ts` with:
- SSE connection to `/api/runs/{runId}/stream`
- Auto-reconnect with exponential backoff (1s → 30s, max 10 attempts)
- Resume from `lastSeq` cursor on reconnection
- Event parsing and validation using existing types
- State: `idle | connecting | connected | reconnecting | error | closed`
- Exposed: `events`, `isLoading`, `isConnected`, `error`, `connect()`, `disconnect()`, `clearEvents()`
