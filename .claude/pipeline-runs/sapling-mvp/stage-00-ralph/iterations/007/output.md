**Completed Sapling-4kz: Implement contract validation**

Implemented:
- `ContractValidator` class with pre-run validation (schema, tool policy conflicts, ID uniqueness, reference integrity)
- Runtime validation of tool calls against `tool_policy`
- Constraint checking for `tool_blocked`, `path_blocked`, `pattern_blocked`, and `custom` rule types
- Drift detection with automatic `drift.detected` event emission
- Fixed `DeliverableType` to include 'pdf' and 'image' (synced with `ArtifactType`)

Files changed: `src/services/contract-validator.ts` (new), `src/services/index.ts`, `src/types/contract.ts`
