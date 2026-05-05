---
description: Iteratively refine plans or beads until plateau
argument-hint: [optional count, "beads", or plan file]
---

# /refine - Iterative Plan/Bead Refinement Loop

Run the refinement loop: iteratively improve beads or plans until plateau.

## Usage
```
/refine              # Auto-detect beads vs plan, run until plateau
/refine 10           # Run exactly 10 iterations
/refine beads        # Force bead refinement mode
/refine plan.md      # Refine specific plan file
```

## What It Does
1. Detects what you have (beads or plan)
2. Spawns Opus subagent for each iteration
3. Reports progress after each round
4. Detects plateau (diminishing improvements)
5. Offers to stop early or continue

## The Pattern

> "Check your beads N times, implement once"

Planning tokens are cheaper than implementation tokens. Running 6+ refinement iterations often finds subtle improvements that compound into significantly better plans.

## Workflow

Invoke the plan-refinery skill with the loop workflow:

```
Read .claude/skills/plan-refinery/workflows/loop.md and execute it.

Arguments:
- If number provided: use as max iterations
- If "beads" provided: force bead-refiner mode
- If file path provided: use plan-improver on that file
- If nothing provided: auto-detect and use default 10 iterations
```

## Plateau Detection

The loop watches for:
- Low change counts (≤1 change per iteration)
- Repeated minor tweaks
- Same areas being adjusted back and forth

When plateau detected after 3+ iterations, you'll be offered:
1. Continue anyway
2. Stop here - ready for implementation
3. Fresh session (for new perspective)
