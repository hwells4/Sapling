# Sapling Mission Control Plan Review (Codex)

This review is based on:
- Plan: `PLAN-mission-control.md`
- Types: `src/types/run.ts`, `src/types/contract.ts`, `src/types/event.ts`, `src/types/artifact.ts`, `src/types/template.ts`
- Services: `src/services/run-orchestrator.ts`, `src/services/run-db.ts`, `src/services/event-store.ts`, `src/services/sandbox-adapter.ts`, `src/services/event-stream.ts`
- API routes: `src/app/api/`
- Hooks: `src/hooks/useEventStream.ts`, `src/hooks/useRun.ts`

**Architecture Critique**
- The plan assumes long‑lived orchestration, but the current API creates a fresh `RunOrchestrator` per request in `src/app/api/runs/route.ts`. That instance dies when the request finishes, so there is no controller to advance phases, handle timeouts, or reconcile approvals.
- The event pipeline is fragmented. `RunOrchestrator` emits through `EventEmitter` (`src/services/events.ts`), but there is no integration with `EventStore` (`src/services/event-store.ts`) or `RunDB.appendEvents` (`src/services/run-db.ts`). Events are not durable, `last_event_seq` is never updated, and reconnection cannot be correct.
- The Phase 1 SQLite schema does not match the runtime types. `RunSchema` (`src/types/run.ts`) includes `workspace_id`, `template_version`, `execution_env`, `previous_state`, `timestamps.updated_at`, `last_event_seq`, and `CostBreakdown`, none of which exist in the proposed `runs` table. `EventSchema` (`src/types/event.ts`) requires `phase` and `severity`, but the `events` table omits both. `ApprovalAuditRecord` in `src/services/run-db.ts` has no persistence plan.
- `useEventStream` expects `/api/runs/:id/stream` (`src/hooks/useEventStream.ts`), but the API returns `/api/runs/:id/events` in `src/app/api/runs/route.ts` and `src/app/api/runs/[id]/route.ts`. There is no SSE route implemented. This is a hard integration break.
- `RunStateMachine` emits `phase.changed` only if constructed with an `EventEmitter`, but all API routes call `createRunStateMachine()` without one. This means `useRun`’s derived `currentPhase` and state updates won’t work as designed.
- The plan switches to tmux‑based OpenClaw sessions (Phase 3), but the existing runtime is `SandboxAdapter` (`src/services/sandbox-adapter.ts`) built on E2B. There is no `AgentSessionAdapter` file today. The plan needs a clear decision and a refactor path.
- Type abstraction drift: `AgentTemplate` (`src/types/template.ts`) describes versioned, immutable templates, while Phase 2 defines mutable “agent directories.” Without a mapping layer, you will end up with two competing sources of truth.

**Gaps (Must‑Haves Missing from the Plan)**
- Event streaming API is missing. There is no `GET /api/runs/[id]/stream` SSE route even though `useEventStream` is built around it and `EventStreamService` exists in `src/services/event-stream.ts`.
- Event ingest API is missing. Phase 3 proposes `POST /api/runs/[id]/events`, but there is no implementation in `src/app/api`.
- Database migrations and schema evolution are not specified. `RunSchema` and `EventSchema` require more fields than the Phase 1 SQL schema provides, and there is no migration strategy in `src/services/sqlite/db.ts`.
- No crash recovery or reconciliation loop. `RunOrchestrator` keeps `approvalTimeoutInterval` in memory; if the process restarts, timeouts are lost. There is no startup scan to reconcile tmux/E2B sessions with persisted runs.
- Output parsing and state progression are undefined. The event bridge only posts `tool.called`, but `RunOrchestrator` never consumes agent output to advance `planning → executing → verifying → packaging`. There is no plan to emit `phase.changed`, `tool.result`, or `artifact.created` from real agent output.
- Approval persistence is missing. `ApprovalService` is in‑memory only (`src/services/approvals.ts`), while `RunDB` defines audit logging (`logApproval`) that is never used.
- Rate limiting and backpressure are not addressed. SSE, approvals, and event ingest endpoints can be spammed. There is no per‑tenant or per‑run throttling.
- Logging/observability is not planned. There is no structured logger, correlation IDs, or metrics for run duration, event throughput, and failure causes.
- API contract mismatch: `Run.event_stream_url` returns `/events`, but the UI expects `/stream` and `useEventStream` listens for SSE `event` messages with `EventSchema`. Without alignment, reconnection and filtering will be unreliable.

**Improvements (Phase‑Specific, Concrete)**
1. Phase 1 (Persistence): Align schema to `RunSchema` and `EventSchema`. Update `src/services/sqlite/run-db.ts` and `src/services/sqlite/event-store.ts` to store `workspace_id`, `template_version`, `execution_env` (JSON), `previous_state`, `timestamps.updated_at`, `last_event_seq`, and full `CostBreakdown` (`compute_cents`, `api_cents`, `total_cents`). Add `phase` and `severity` columns to `events`, and persist `ApprovalAuditRecord` data.
2. Phase 2 (Agent Directory System): Introduce a mapping layer between agent folders and `AgentTemplate` / `TemplateCatalogEntry` in `src/types/template.ts`. If directories are the source of truth, add a new type (e.g., `AgentDirectory`) and have `src/services/agent-catalog.ts` emit both directory metadata and a derived `AgentTemplateRef`.
3. Phase 3 (Agent Runtime): Add `src/services/agent-session.ts` with a clear interface, then refactor `RunOrchestrator` (`src/services/run-orchestrator.ts`) to depend on `AgentSessionAdapter` instead of `SandboxAdapter`, or create a parallel orchestrator for tmux sessions. Move orchestration into a long‑running worker process so timeouts and phase transitions are durable.
4. Phase 4 (Kanban): Avoid one SSE connection per card. Build a multiplexed stream per run list using `EventStreamService` (`src/services/event-stream.ts`) and a `useRunList` hook that fan‑outs events client‑side.
5. Phase 5 (QMD): Run `qmd embed` outside request lifecycles and enforce tenant‑scoped collections. Add a bounded queue for reindexing to avoid blocking API threads.
6. Phase 6 (Auth + Prod): Propagate tenant identity into `workspace_id` and enforce it in `RunDB.listRuns` and `RunDB.getRun`. Cloudflare Access alone does not provide data isolation.

**Timeline Reality Check**
- 10–14 days is optimistic for a solo developer given the current architecture gaps. The critical path is not just “Phase 1 → 2 → 3 → 4”; it is “Persistence that matches types → Durable event pipeline → Long‑running orchestration → Output parsing and phase transitions.” Each of these is multi‑day.
- Realistic solo timeline: 3–4 weeks to get a reliable MVP that matches the types and plan assumptions. The most time will be lost in debugging orchestration lifecycle issues and event ordering.

**Risk Assessment (Top 5 + Mitigation)**
1. Orchestrator lifecycle mismatch (per‑request `RunOrchestrator` dies early) — Move orchestration into a worker process or durable queue; store run state transitions in `RunDB` so the worker can resume.
2. Event durability and ordering (EventEmitter not persisted, seq collisions) — Implement a persistent emitter that writes to `EventStore` and uses `RunDB` to manage `last_event_seq` atomically.
3. Runtime mismatch (E2B `SandboxAdapter` vs tmux OpenClaw) — Decide on a single runtime abstraction and refactor `RunOrchestrator` to depend on that interface.
4. Security exposure from `claude --dangerously-skip-permissions` and unauthenticated hooks — Require signed tokens on `POST /api/runs/[id]/events`, remove “dangerously skip permissions”, and enforce least‑privilege settings in agent `.claude/settings.json`.
5. SQLite concurrency limits in multi‑process deployments — Lock to a single Node process or switch to Postgres; use WAL and a migration system to avoid locking and corruption.

**Quick Wins (Under 2 Hours Each)**
1. Implement `GET /api/runs/[id]/stream` SSE using `EventStreamService` (`src/services/event-stream.ts`) and update `event_stream_url` responses to match `useEventStream` (`src/hooks/useEventStream.ts`).
2. Pass `EventEmitter` into `createRunStateMachine(eventEmitter)` everywhere so `phase.changed` events are emitted and `useRun` updates correctly.
3. Add `POST /api/runs/[id]/events` with `EventSchema` validation to unblock the hook bridge.
4. Add `GET /api/runs/[id]/events` with pagination using `RunDB.queryEvents` to support initial history load and reconnection.
5. Add a minimal structured logger that prefixes `run_id` and `checkpoint_id` in `RunOrchestrator` to make debugging feasible.

**Security Review**
- Authentication is missing across all APIs. `POST /api/runs`, approvals, and event ingest must require auth and tenant scoping, not just perimeter Access. Use `src/middleware.ts` early to enforce identity.
- The event bridge (`agents/_base/.claude/hooks/event-bridge.sh` in the plan) posts to localhost with no auth or replay protection. This allows forgery and cross‑run event injection. Require a per‑run token and validate it server‑side.
- `claude --dangerously-skip-permissions` is a critical risk. It bypasses tool permission controls and undermines `ToolPolicySchema` and constraints in `src/types/contract.ts`.
- Agent directories are filesystem‑based. Any API that reads or writes them must validate slugs to prevent path traversal and must never allow direct write of executable hooks without review.
- Secrets and credentials are not isolated. The existing `credential-store` service is in‑memory; the plan must specify encrypted at‑rest storage and per‑tenant scoping.
- SSE endpoints can leak sensitive event payloads. Enforce tenant filters on every stream and redact tool inputs that may include secrets.
- QMD indexing will ingest everything in `brain/`; without careful scoping and filtering, it will index secrets and PII. Add allow/deny filters and separate indexes per tenant.

