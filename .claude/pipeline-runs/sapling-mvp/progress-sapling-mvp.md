# Progress: sapling-mvp

Verify: (none)

## Codebase Patterns
- **Types**: All domain types use Zod schemas with exported TypeScript types in `src/types/`
- **Validation**: Use `isValid*` and `validate*` helper functions from types for runtime validation
- **Events**: Event system uses typed payloads via `EventPayloadMap` with `createEvent` factory
- **Hooks**: React hooks go in `src/hooks/` with index.ts barrel export
- **SSE Integration**: Server uses `EventSource` API; client hooks handle reconnection via `afterSeq` cursor

---

## 2026-01-22 - Sapling-370: Implement useEventStream hook
- Created `src/hooks/useEventStream.ts` with full SSE streaming support
- Implemented auto-reconnect with exponential backoff (1s initial, 30s max, 10 attempts)
- Added event deduplication by `event_id` and ordering by `seq`
- Exposed loading/error/connected states plus manual connect/disconnect controls
- Files: `src/hooks/useEventStream.ts`, `src/hooks/index.ts`
- **Learnings**: EventSource API handles SSE natively; use `.addEventListener('event', ...)` for named events
---

