# Progress: sapling-mvp

Verify: (none)

## Codebase Patterns
- **Types**: All domain types use Zod schemas with exported TypeScript types in `src/types/`
- **Validation**: Use `isValid*` and `validate*` helper functions from types for runtime validation
- **Events**: Event system uses typed payloads via `EventPayloadMap` with `createEvent` factory
- **Hooks**: React hooks go in `src/hooks/` with index.ts barrel export
- **SSE Integration**: Server uses `EventSource` API; client hooks handle reconnection via `afterSeq` cursor
- **Components**: Components go in `src/components/<feature>/` with index.ts barrel export; use `cn()` from `@/lib/cn` for class merging

---

## 2026-01-22 - Sapling-370: Implement useEventStream hook
- Created `src/hooks/useEventStream.ts` with full SSE streaming support
- Implemented auto-reconnect with exponential backoff (1s initial, 30s max, 10 attempts)
- Added event deduplication by `event_id` and ordering by `seq`
- Exposed loading/error/connected states plus manual connect/disconnect controls
- Files: `src/hooks/useEventStream.ts`, `src/hooks/index.ts`
- **Learnings**: EventSource API handles SSE natively; use `.addEventListener('event', ...)` for named events
---

## 2026-01-22 - Sapling-06z: Build results review screen
- Created `src/components/results/results-review.tsx` with artifact-first design
- Deliverables list with type-based icons (email, calendar, markdown, diff, json, binary)
- Status badges (final/draft/partial) with appropriate color coding
- Receipt summary: 2x2 grid showing files read/written, actions proposed/executed
- Export to vault: multi-select with "Select all" toggle, disabled when none selected
- Trace link: opens in new tab for calibration workflow
- Empty state: spinner + "Working..." during run, static placeholder otherwise
- Files: `src/components/results/results-review.tsx`, `src/components/results/index.ts`
- **Learnings**: Use `PreviewType` from ArtifactManifest for icon selection; pattern of section components with SectionHeader helper
---

## 2026-01-22 - Sapling-k1s: Implement vault writer for artifacts
- Created `src/services/vault-writer.ts` with VaultWriter class
- Writes artifacts to `brain/outputs/YYYY/MM/<run_id>_<slug>.md` structure
- YAML frontmatter: run_id, agent, source, created_at, status, type, description
- Filename normalization: slugify (lowercase, special chars, max 100 chars)
- Atomic writes: write to .tmp file, then rename for safety
- Overwrite protection: appends -2, -3 suffix on filename collision
- Returns ArtifactManifest with checksum, size_bytes, destination_path
- Files: `src/services/vault-writer.ts`, `src/services/index.ts`
- **Learnings**: Use Node.js crypto for SHA256 checksums; fs.rename for atomic file operations
---

## 2026-01-22 - Sapling-23x: Implement trace writer
- Created `src/services/trace-writer.ts` with TraceWriter class
- Writes `brain/traces/YYYY/MM/<run_id>.md` with YAML frontmatter
- Writes companion `brain/traces/YYYY/MM/<run_id>.jsonl` for detailed events
- Trace includes: contract snapshot, phase summary, decisions log, tool calls, errors & recoveries, calibration seeds
- Structured JSONL entries: ContractEntry, PhaseStartEntry, PhaseEndEntry, ToolCallEntry, ToolResultEntry, ErrorEntry, RecoveryEntry, CalibrationSeedEntry
- Atomic writes (write to .tmp, then rename)
- Markdown sections: Contract Summary, Outcome, Phase Summary table, Decisions Log, Errors & Recoveries, Calibration Notes
- Files: `src/services/trace-writer.ts`, `src/services/index.ts`
- **Learnings**: Follow existing Sapling trace conventions; traces are non-negotiable for calibration loop; use typed entry interfaces for JSONL
---

## 2026-01-22 - Sapling-njn: Implement run DB (ledger)
- Created `src/services/run-db.ts` with RunDB interface and InMemoryRunDB implementation
- Run CRUD: create, read, list (with filtering by workspace/template/state), update state
- Event log integration: delegates to EventStore for append-only event storage
- Artifact pointers: store vault paths + object store URIs, update support
- Approval audit log: records who approved/rejected what, when, from where (web/mobile/api)
- Transaction support: InMemoryRunDBTransaction for atomic run creation + initial events
- Designed for backend swap: InMemory for dev, SQLite for local, Convex for web
- Files: `src/services/run-db.ts`, `src/services/index.ts`
- **Learnings**: RunDB is the ledger (system state), not knowledge storage (vault); EventStore abstraction allows clean separation; transactions enable atomic run+events creation
---

