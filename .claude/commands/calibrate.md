---
description: Analyze decision traces and calibrate the system to your preferences
argument-hint: "[date filter, e.g., 2025-12-26]"
---

# /calibrate Command

Analyzes unreviewed decision traces and proposes targeted improvements to skills, CLAUDE.md, and workflows. Calibrates the system to your preferences through human-approved changes.

## Usage

```
/calibrate              # All unreviewed traces
/calibrate 2025-12-26   # Only traces from Dec 26
/calibrate 12-26        # Short form (assumes current year)
```

## Date Filter: $ARGUMENTS

If a date is provided, only analyze traces from that date. Otherwise, analyze all unreviewed traces.

## Execution

**IMMEDIATELY invoke the `calibrate` skill** using the Skill tool:

```
Skill(skill: "calibration-workflow", args: "$ARGUMENTS")
```

The skill handles everything:
1. Collect traces (filtered by date if specified)
2. Extract individual decisions/learnings with per-item importance
3. Spawn 3 analysis agents (architecture-strategist, simplicity-advocate, pattern-recognizer)
4. Coordinate via chatroom to discover cross-trace patterns
5. Generate calibration proposal document
6. Present approval options
7. Apply selected changes, bump VERSION, create atomic commit
8. Show "CALIBRATION COMPLETE" with rollback instructions

## New Skills

If agents discover a pattern that warrants a NEW skill (not editing existing), they'll propose `skill:new:{name}`. The workflow creates an inbox item instead of applying directly — run `/create-skill` after calibration.
