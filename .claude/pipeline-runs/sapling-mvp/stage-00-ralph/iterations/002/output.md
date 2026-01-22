Done. Completed **Sapling-3rh: Implement EventEmitter service**.

**Summary:**
- Fixed type safety issues in `src/types/event.ts`:
  - Extended Phase enum to match all RunState values
  - Added `EventPayloadSchemas` discriminated union mapping event types to payload schemas
  - Added `TypedEvent<T>` and `CreateEventInput<T>` for compile-time payload enforcement
  - Refactored `createEvent<T>` to constrain payload types
  - Added `validateEventPayload()` for runtime validation

- Created `src/services/events.ts` with:
  - `EventEmitter` interface (emit, subscribe, getSeq, getEvents, clearRun)
  - `InMemoryEventEmitter` implementation with monotonic seq per run, payload validation, and subscription filtering
  - `createEventEmitter()` factory function
