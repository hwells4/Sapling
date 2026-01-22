Done. I completed **Sapling-s1v: Implement error handling and recovery**:

**Implemented:**
- `ErrorHandler` class with 8 error categories (transient, tool_failure, agent_error, sandbox_crash, contract_violation, timeout, approval_timeout, stalled)
- Auto-retry with exponential backoff (2s → 4s → 8s) with per-category limits
- Human-readable error messages with context interpolation
- Partial results preservation for recovery
- Integration with RunStateMachine and EventEmitter

**Files:** `src/services/error-handler.ts`, `src/services/index.ts`
