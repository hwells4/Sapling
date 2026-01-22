**Completed: Sapling-wun - Implement RunStateMachine**

Implemented:
- Fixed bug in `run.ts`: verifying state now allows transition to 'paused'
- Created `RunStateMachine` service with:
  - `transition()` for orchestrator-driven phase changes
  - `performAction()` for user actions (pause/resume/cancel/approve/reject/retry)
  - `detectDrift()` for agent behavior violations
  - `StateMachineError` with typed error handling
- Validates `previous_state` requirements for pause/approval states
- Emits `phase.changed` events on all transitions
