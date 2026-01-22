Completed **Sapling-k2n: Implement Run Orchestrator**.

**Summary:**
- Created `src/services/run-orchestrator.ts` with the `RunOrchestrator` class
- The orchestrator is the central control plane coordinating:
  - Sandbox lifecycle (create, manage, cleanup)
  - State machine transitions
  - Approval service for checkpoints
  - Event emission for real-time UI updates
  - Artifact collection and vault writing
  - Trace writing on run completion
  - Cost tracking integration
  - Contract validation
- Implemented run lifecycle methods: `start()`, `pause()`, `resume()`, `cancel()`
- Integrated with all dependent services via dependency injection pattern
- Emits `run.started` and `run.completed/failed` events
- Factory function `createRunOrchestrator()` for easy instantiation
