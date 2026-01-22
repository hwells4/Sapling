Done. I completed **Sapling-pks: Implement approval flow**:

**Summary:**
- Created `ApprovalService` interface in `src/services/approvals.ts` with:
  - `requestApproval()` - creates pending approval from checkpoint.requested event, transitions run to awaiting_approval
  - `approve()` / `reject()` - user actions integrated with RunStateMachine
  - `bulkApprove()` - batch approve by action_type or run_id  
  - `processTimeouts()` - handles expired approvals with configurable auto-approve or auto-reject

- Implemented `InMemoryApprovalService` with:
  - Complete audit logging (actor_id, timestamp, source)
  - Pending approval tracking with timeout expiration
  - Run-to-checkpoint mapping for efficient lookups

- Added exports to `src/services/index.ts`
- Typecheck passes
