Completed **Sapling-njn: Implement run DB (ledger)**.

**Summary:**
- Created `src/services/run-db.ts` with full RunDB interface and InMemoryRunDB implementation
- **Run CRUD**: create, read, list (filter by workspace/template/state), update state, mark started/completed
- **Event log**: integrates with EventStore abstraction for append-only event storage
- **Artifact pointers**: store vault paths + object URIs, with update support
- **Approval audit log**: tracks who approved/rejected, when, from what source (web/mobile/api/timeout)
- **Transactions**: InMemoryRunDBTransaction for atomic run creation + initial events
- **Backend-swappable design**: In-memory for dev, designed for SQLite local / Convex web swap
