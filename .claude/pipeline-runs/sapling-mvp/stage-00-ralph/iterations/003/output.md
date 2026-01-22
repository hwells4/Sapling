Done. I completed one task:

**Sapling-767: Implement event persistence layer**

Created the `EventStore` interface and `InMemoryEventStore` implementation with:
- Append-only writes with idempotent deduplication on event_id
- Strict seq ordering validation per run_id
- Paginated queries with cursor support (`EventCursor`, `EventPage`)
- Event type filtering
- Run statistics (`EventStats`)
- Factory function `createEventStore()`

Files changed: `src/services/event-store.ts` (new), `src/services/index.ts` (updated exports)
