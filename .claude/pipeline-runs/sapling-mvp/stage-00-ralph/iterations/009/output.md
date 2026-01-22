Done. Completed **Sapling-c1t: Implement cost tracking**.

Summary of what was implemented:
- `CostTracker` service tracking E2B compute, Claude API, and external API costs
- Workspace-level budget enforcement (per-run, daily, monthly limits with warning thresholds)
- Pre-run cost estimation with variance bounds
- Fixed `CostBreakdownSchema` with validation that `total_cents` equals `compute_cents + api_cents`
- Added `createCostBreakdown()` helper for consistent cost object creation
