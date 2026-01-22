# Progress: sapling-mvp

Verify: (none)

## Codebase Patterns
- **Zod schemas**: Use `z.enum()` for union types, `z.object()` for interfaces. Export both schema and inferred type.
- **Type exports**: Follow pattern in `src/types/index.ts` - export schemas, enums, types, and helper functions separately.
- **Services pattern**: Create service interfaces with `StoreResult<T>` return types for operations. Place in `src/services/`.
- **WebCrypto usage**: Cast `Uint8Array` to `BufferSource` for TypeScript compatibility with WebCrypto APIs.
- **Factory functions**: Use factory functions (e.g., `createCredentialStore`) for environment-based implementation selection.

---

## 2026-01-22 - Sapling-chu: Implement credential storage service
- Created `CredentialStore` interface with store/get/list/revoke/refresh operations
- Implemented AES-256-GCM encryption using WebCrypto (PBKDF2 key derivation, 100k iterations)
- Added `InMemoryCredentialStore` implementation for development
- Built audit logging system tracking credential access, refresh, and revocation
- Files: `src/services/credential-store.ts`, `src/services/index.ts`
- **Learnings**: WebCrypto's `Uint8Array` needs explicit `BufferSource` cast for TypeScript. Backend-only credential access pattern ensures tokens never leak to frontend.
---

## 2026-01-22 - Sapling-3rh: Implement EventEmitter service
- Fixed Phase enum to include all RunState values (initializing, awaiting_approval, paused, cancelled, timeout)
- Created discriminated union type safety: `EventPayloadSchemas` maps event types to payload schemas
- Added `TypedEvent<T>` for compile-time payload type enforcement based on event type discriminator
- Refactored `createEvent<T>` to constrain payload type based on event type generic
- Added `validateEventPayload()` for runtime payload validation
- Implemented `EventEmitter` interface with emit/subscribe/getSeq/getEvents/clearRun operations
- Created `InMemoryEventEmitter` with monotonic seq per run_id, payload validation, and subscription filtering
- Files: `src/types/event.ts`, `src/types/index.ts`, `src/services/events.ts`, `src/services/index.ts`
- **Learnings**: Using `EventPayloadSchemas` as a const object allows both runtime validation and type-level mapping. Subscriptions need to handle replay on connect (afterSeq option) for reconnection scenarios.
---

## 2026-01-22 - Sapling-767: Implement event persistence layer
- Created `EventStore` interface for durable event storage (distinct from EventEmitter which handles real-time)
- Implemented `InMemoryEventStore` with:
  - Append-only writes with idempotent event_id deduplication
  - Strict seq ordering validation per run_id
  - Paginated query with cursor (`EventCursor`) for large streams
  - Event type filtering in queries
  - Run statistics (`EventStats`) for summaries
- Added `StoreResult<T>` pattern matching other services
- Files: `src/services/event-store.ts`, `src/services/index.ts`
- **Learnings**: EventStore and EventEmitter serve different purposes - Store is for persistence/replay, Emitter is for real-time pub/sub. Pagination with cursors uses afterSeq pattern for consistent iteration.
---

## 2026-01-22 - Sapling-2qd: Implement SSE/WebSocket event streaming
- Created `EventStreamService` interface for real-time HTTP streaming
- Implemented `InMemoryEventStreamService` bridging EventEmitter to HTTP clients:
  - SSE: `createSSEStream()` with heartbeat (30s default), retry hints, seq-based event IDs
  - WebSocket: `createWebSocketStream()` with ping/pong (30s default), subscribed confirmation
- Reconnection support via `afterSeq` cursor - clients can resume from last seen seq
- Connection tracking: `StreamConnection` metadata, `getConnections()`, `closeConnection()`
- Utilities: `formatSSEMessage()` for HTTP response, `parseStreamOptions()` for query params
- Files: `src/services/event-stream.ts`, `src/services/index.ts`
- **Learnings**: SSE uses `event:`, `id:`, `retry:`, `data:` fields with double-newline terminator. WebSocket needs explicit ping/pong for connection health. Both need to track lastSeq per connection for replay.
---

## 2026-01-22 - Sapling-wun: Implement RunStateMachine
- Fixed bug: VALID_TRANSITIONS for 'verifying' state was missing 'paused' as destination
- Created `RunStateMachine` class enforcing all state transitions:
  - `transition()` for orchestrator-driven transitions (phase completion)
  - `performAction()` for user-initiated actions (pause, resume, cancel, approve, reject, retry)
  - `detectDrift()` for drift detection when agent actions don't match phase
- Validates `previous_state` requirements:
  - States `awaiting_approval` and `paused` require coming from a resumable state (planning/executing/verifying)
  - Resume/approve only allowed when `previous_state` is set and matches target
- Emits `phase.changed` events on all transitions via injected EventEmitter
- `StateMachineError` class with typed `errorType` for handling specific failure modes
- Files: `src/services/run-state-machine.ts`, `src/types/run.ts`, `src/services/index.ts`
- **Learnings**: User actions map to state transitions with context (e.g., reject reason determines target state). State machine validation must check both the transition AND the previous_state invariants.
---

## 2026-01-22 - Sapling-pks: Implement approval flow
- Created `ApprovalService` interface for managing checkpoint approval workflow:
  - `requestApproval()` - creates pending approval, transitions run to awaiting_approval
  - `approve()` / `reject()` - user actions with state machine integration
  - `bulkApprove()` - approve multiple pending checkpoints by action_type or run_id
  - `processTimeouts()` - handles expired approvals with configurable auto-action
- Implemented `InMemoryApprovalService` with:
  - Pending approval tracking with timeout expiration
  - Audit logging with actor_id, timestamp, source (web/desktop/mobile/api/bulk/timeout)
  - Integration with RunStateMachine for state transitions
  - Run-to-checkpoint mapping for efficient lookups
- Zod schemas for ApprovalStatus, ApprovalSource, RejectionReason, TimeoutAction
- Files: `src/services/approvals.ts`, `src/services/index.ts`
- **Learnings**: ApprovalService needs getter/setter callbacks for Run state since it doesn't own persistence. Timeout can auto-approve (configurable) or auto-reject (default). Bulk approval uses 'bulk' source in audit log but 'api' in checkpoint.approved event.
---

## 2026-01-22 - Sapling-4kz: Implement contract validation
- Created `ContractValidator` class in `src/services/contract-validator.ts`:
  - Pre-run validation: schema, tool policy conflicts, ID uniqueness, reference integrity
  - Runtime validation: tool calls against tool_policy (allowed/blocked lists)
  - Constraint checking: tool_blocked, path_blocked, pattern_blocked, custom rule types
  - Drift detection with automatic `drift.detected` event emission via EventEmitter
- Fixed contract type bugs:
  - Added 'pdf' and 'image' to DeliverableType (synced with ArtifactType)
  - Added comment noting tool_policy conflict is validated at runtime
- Path matching supports glob patterns with `*` and `**` wildcards
- Constraint context includes tool_name, file_path, action, and metadata
- Files: `src/services/contract-validator.ts`, `src/services/index.ts`, `src/types/contract.ts`
- **Learnings**: ToolPolicy conflicts (same tool in allowed & blocked) must be runtime validated since Zod superRefine breaks inference. EventEmitter uses positional args, not object. Uniqueness checks across arrays prevent subtle bugs in contracts.
---

## 2026-01-22 - Sapling-s1v: Implement error handling and recovery
- Created `ErrorHandler` class in `src/services/error-handler.ts`:
  - 8 error categories: transient, tool_failure, agent_error, sandbox_crash, contract_violation, timeout, approval_timeout, stalled
  - Auto-retry with exponential backoff (2s, 4s, 8s base) capped at configurable max delay
  - Category-specific retry limits: transient(3), tool_failure(2), sandbox_crash(1), others(0)
  - `classifyError()` heuristics to auto-detect category from error type/message
- Human-readable error messages:
  - Static `USER_MESSAGES` for each category
  - Dynamic `DETAILED_USER_MESSAGES` with context interpolation (retry count, tool name, timeout, etc.)
- Partial results preservation via `PartialResultsSchema`:
  - Captures artifacts, files_changed, last_phase, last_event_seq
  - Allows run recovery from failure checkpoint
- Integration: RunStateMachine for `failed` transitions, EventEmitter for `run.failed` events
- Files: `src/services/error-handler.ts`, `src/services/index.ts`
- **Learnings**: Retry tracking needs per-run/per-category map since different error types exhaust independently. Exponential backoff uses `baseDelay * 2^retryCount` capped at maxDelay. State machine integration requires checking `isTerminalState` first.
---

## 2026-01-22 - Sapling-c1t: Implement cost tracking
- Created `CostTracker` class in `src/services/cost-tracker.ts`:
  - Track 3 cost types: e2b_compute, claude_api, external_api
  - `trackE2BUsage()`, `trackClaudeUsage()`, `trackExternalAPIUsage()` convenience methods
  - `getCostBreakdown()` aggregates costs into compute vs API buckets
- Budget enforcement via `BudgetConfig`:
  - Per-run, per-day, per-month spending limits
  - Warning threshold (default 80%) alerts before hard limit
  - `checkBudget()` returns detailed `BudgetStatus` with which limit would be exceeded
- Pre-run cost estimation via `estimateCost()`:
  - Accepts goalTokens, estimatedMinutes, expectedToolCalls
  - Returns low/high bounds with ±30% variance
- Fixed bug in `CostBreakdownSchema`:
  - Added Zod refinement to validate `total_cents === compute_cents + api_cents`
  - Created `createCostBreakdown()` helper for consistent total computation
- Files: `src/services/cost-tracker.ts`, `src/services/index.ts`, `src/types/run.ts`, `src/types/index.ts`
- **Learnings**: Cost tracking needs separate daily/monthly totals per workspace (keyed by workspace:YYYY-MM-DD). Budget checks must prevent spend before adding, not after. Transform vs refinement: refinement for validation, transform for auto-compute.
---

