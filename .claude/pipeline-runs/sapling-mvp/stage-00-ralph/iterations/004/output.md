**Completed: Sapling-2qd - Implement SSE/WebSocket event streaming**

Implemented real-time event streaming with:
- **SSE endpoint**: `createSSEStream()` with 30s heartbeat, retry hints, seq-based IDs
- **WebSocket endpoint**: `createWebSocketStream()` with 30s ping/pong, subscribed confirmation
- **Reconnection**: `afterSeq` cursor for resuming from last seen seq
- **Connection tracking**: metadata, list connections, close by ID or run
- **Utilities**: `formatSSEMessage()` and `parseStreamOptions()` helpers

Files: `src/services/event-stream.ts`, `src/services/index.ts`
