---
name: calibration-workflow
description: Analyze decision traces and calibrate the system to your preferences. Proposes targeted improvements to skills, CLAUDE.md, and workflows based on patterns in your decisions. Use periodically or after accumulating decision traces.
context_budget:
  skill_md: 200
  max_references: 4
---

<objective>
Analyze unreviewed decision traces, identify patterns and gaps, and propose prioritized improvements to the Personal OS. Calibrates the system to your preferences through human-approved changes.
</objective>

<usage>
```
/calibrate              # All unreviewed traces
/calibrate 2025-12-26   # Only traces from Dec 26
/calibrate 12-26        # Short form (assumes current year)
```
</usage>

<essential_principles>
1. **Per-item granularity:** Each decision/learning within a trace gets its own importance rating
2. **Three perspectives:** architecture-strategist, simplicity-advocate, pattern-recognizer analyze ALL items
3. **Cross-trace discovery:** Agents find patterns across traces that weren't visible during individual task execution
4. **Chatroom coordination:** Agents coordinate via chatroom to avoid duplicate proposals
5. **Human approval required:** All changes require explicit user approval before application
6. **Importance ranking:** Proposals sorted critical → high → medium → low
7. **Propose, don't overreach:** Small edits → apply directly. New skills → add to inbox for /create-skill
8. **Version tracking:** Each calibration bumps the OS version (VERSION file)
9. **Easy rollback:** Each calibration creates a single atomic commit that can be reverted
</essential_principles>

<quick_start>
1. Collect unreviewed traces
2. Create chatroom, spawn 3 analysis agents in parallel
3. Agents analyze, discover patterns, coordinate proposals
4. Present approval options (apply all / select / cancel)
5. Apply selected changes, mark traces as `review_status: applied`
6. Write calibration output ONCE → **hook auto-handles:** version bump, archive traces, update stats, stage all
7. Run /commit → single atomic commit with everything
8. Show evolution banner with level progress
</quick_start>

<workflow>
## Phase 1: Context Collection

Collect unreviewed traces using the helper script (avoids reading all files):

```bash
python3 .claude/scripts/list-unreviewed-traces.py [date_filter]
```

**Examples:**
- `python3 .claude/scripts/list-unreviewed-traces.py` → all unreviewed
- `python3 .claude/scripts/list-unreviewed-traces.py 2025-12-28` → single date
- `python3 .claude/scripts/list-unreviewed-traces.py "2025-12-27 and 2025-12-28"` → multiple dates

**Script returns:**
- Trace paths, dates, tasks, targets
- Decision/learning counts per trace
- Total counts for summary

**System Inventory (paths only, agents read on-demand):**
- Skills: `.claude/skills/*/SKILL.md`
- Hooks: `.claude/hooks/*.py`
- CLAUDE.md files: `CLAUDE.md`, `brain/CLAUDE.md`, `.claude/CLAUDE.md`
- Schemas: `schemas/vault/*.yaml`

## Phase 2: Coordinated Analysis

Create chatroom with proper frontmatter, then spawn ALL 4 agents in parallel.

**Chatroom file:** `brain/traces/agents/{date}-calibrate.md`

```yaml
---
schema_version: 1.0.0
date: {YYYY-MM-DD}
task: Calibration analysis of {n} traces from {date_filter}
agents: [coordinator, architecture-strategist, simplicity-advocate, pattern-recognizer]
status: active
---

# Agent Chatroom: Calibration Analysis

## Coordination Log
```

**Spawn 4 agents in ONE message using 4 Task tool calls:**

| Agent | Role | What It Does | Output Budget |
|-------|------|--------------|---------------|
| coordinator | Orchestration | Watches chatroom, waits for 3 `-> READY`, posts `-> CLOSE`, synthesizes all proposals | 3,000 words |
| architecture-strategist | Analysis | Reads traces, identifies gaps, posts findings + `-> READY` | 2,000 words |
| simplicity-advocate | Analysis | Reads traces, finds over-engineering, posts findings + `-> READY` | 2,000 words |
| pattern-recognizer | Analysis | Reads traces, finds patterns, posts findings + `-> READY` | 2,000 words |

**All 4 spawned by orchestrator (main conversation) using Task tool.**
All have hooks. All can write to chatroom. Coordinator doesn't spawn anyone - just coordinates.

**Give each agent:**
- Trace paths from script output (not contents)
- System inventory paths (not contents)
- Chatroom path
- Their specific role and output budget

**Orchestrator waits for coordinator's TaskOutput only.**
Coordinator returns synthesized report. Other 3 agents' outputs stay in their contexts.

## Phase 3: Proposal Generation

After all agents post `-> READY`:
1. Post `-> CLOSE` to chatroom
2. Collect TaskOutput from each agent
3. Deduplicate proposals (agents may identify same issue)
4. Merge importance ratings (take highest if disagreement)
5. Generate calibration proposal at `brain/outputs/calibrations/{date}-calibration.md`

## Phase 4: Human Approval

Present summary and options via AskUserQuestion:

```
CALIBRATION COMPLETE

Traces analyzed:     {count}
Proposals:           {count}
Learnings captured:  {count}

CRITICAL ({count})
  1. {target}: {title} ({trace_count} traces)
  ...

HIGH ({count})
  ...

What would you like to do?

[1] Apply all & commit
[2] Apply all & review first
[3] Select specific changes
[4] Cancel
```

## Phase 5: Application

Based on user choice:

**Option 1 (Apply all & commit):**
1. Apply each edit in sequence
2. Mark all processed traces as `review_status: applied`
3. Write calibration output file ONCE (with full content + Result banner) → **hook fires:**
   - Bumps VERSION (patch)
   - Moves applied traces to `brain/traces/processed/`
   - Updates `.claude/stats.yaml` with new count + level
   - Stages everything with `git add`
   - Returns message: "All changes staged. Run /commit to finalize."
4. Run `/commit` to create single atomic commit including ALL changes
5. Show evolution banner with level progress

**IMPORTANT:** Only write the calibration output file ONCE, at the very end. The hook triggers on this write and does all the housekeeping.

**Option 2 (Apply all & review first):**
- Apply edits but don't commit
- Show git diff for review
- Wait for user confirmation
- Then bump VERSION and continue with steps 4-6 above

**Option 3 (Select specific):**
- Ask which upgrades to apply (comma-separated numbers)
- Apply selected only
- Mark applied traces as `review_status: applied`
- Mark skipped traces as `review_status: skipped`
- Continue with steps 3-6 above

**Option 4 (Cancel):**
- No changes made
- Traces remain pending
- User can re-run later
</workflow>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/sub-agents.md | Agent definitions, prompts, coordination protocol |
</references_index>

<leveling_system>
Track progress in `.claude/stats.yaml`:

```yaml
total_traces_processed: {count}
total_calibrations: {count}
last_calibration: {date}
creature: ember  # ember | drift | bloom (set during /onboard)
```

**Evolution stages (faster first hatch):**
| Stage | Traces | Name | Notes |
|-------|--------|------|-------|
| 1 | 0-9 | Egg | First calibration hatches it |
| 2 | 10-99 | Hatchling | Day 1 achievement |
| 3 | 100-499 | Juvenile | ~1-2 weeks |
| 4 | 500-1499 | Adult | ~1-2 months |
| 5 | 1500+ | Legendary | Long-term goal |

**Creature emoji map:**
| Creature | Emoji |
|----------|-------|
| ember | 🔥 |
| drift | 💧 |
| bloom | 🌿 |
| (none) | 🌱 |

**After applying changes:**
1. Count total traces with `review_status: applied`
2. Update `.claude/stats.yaml`
3. Calculate stage from trace count
4. If creature set: Read art from `.claude/creatures/{creature}/{stage}.txt`
5. Display evolution banner with creature
</leveling_system>

<rollback_protocol>
Every calibration creates a SINGLE atomic commit for easy rollback.

**Rollback command:** After committing, print `git revert <sha>` to terminal. Do NOT try to embed the commit SHA in the output file (this requires a two-commit pattern that adds complexity). The rollback command is ephemeral but sufficient.

**Evolution display after calibration:**

Shows after EVERY calibration - creature art (right) + metrics + changes in one compact screen.

**Creature art height by stage (grows as it evolves):**
| Stage | Height |
|-------|--------|
| Egg | 3 lines |
| Hatchling | 5 lines |
| Juvenile | 7 lines |
| Adult | 9 lines |
| Legendary | 11 lines |

**Layout principles:**
- Header combines: name · stage · version (compact)
- Metrics inline where possible
- Applied list flows alongside creature
- Separator above progress bar
- No wasted whitespace

If creature is set (user ran /onboard):

**Egg (3 lines):**
```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  🔥 EMBER · Egg · v1.0.2 → v1.0.3                      ___       ║
║  Traces: 8 processed · 3 applied                     ( 🔥 )      ║
║                                                       \_/        ║
║  ✓ calibration-workflow: Add evolution stages                    ║
║  ✓ CLAUDE.md: Update querying docs                               ║
║                                                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  [████░░░░░░░░░░░░░░░░] 8/10 to Hatchling                        ║
║  To undo: git revert {sha}                                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**Hatchling (5 lines):**
```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  🔥 EMBER · Hatchling · v1.0.5 → v1.0.6                ^  ^      ║
║  Traces: 12 processed · 4 applied                    (o  o)      ║
║                                                     (  🔥  )     ║
║  ✓ calibration-workflow: Add evolution stages        \    /      ║
║  ✓ CLAUDE.md: Update querying docs                    \  /       ║
║  ✓ today skill: Fix date formatting                              ║
║                                                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  [██████░░░░░░░░░░░░░░] 45/100 to Juvenile                       ║
║  To undo: git revert {sha}                                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**Legendary (11 lines):**
```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  🔥 EMBER · Legendary                           🔥  /\  🔥        ║
║  v2.1.0 → v2.1.1                                   /  \          ║
║                                                   / 🔥🔥 \        ║
║  Traces: 1847 processed                          /   ||   \      ║
║  Changes: 6 applied                             /    ||    \     ║
║                                                ( 🔥  ||  🔥 )     ║
║  ✓ calibration-workflow: Refactor              \    ||    /      ║
║  ✓ CLAUDE.md: Major update                      \   ||   /       ║
║  ✓ onboard: Add new creature                     \  ||  /        ║
║  ✓ today: Performance fix                     ~~~~ ETERNAL ~~~~  ║
║  ✓ client-context: Bug fix                                       ║
║  ✓ email-draft: New template                                     ║
║                                                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  [████████████████████] 1847/1500 · LEGENDARY ACHIEVED           ║
║  To undo: git revert {sha}                                       ║
╚══════════════════════════════════════════════════════════════════╝
```

Read creature art from `.claude/creatures/{creature}/{stage}.txt` and display on RIGHT side.

If no creature (user hasn't run /onboard):
```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  🌱 PERSONAL OS · v1.0.2 → v1.0.3                                ║
║  Traces: 8 processed · 3 applied                                 ║
║                                                                  ║
║  ✓ calibration-workflow: Add evolution stages                    ║
║  ✓ CLAUDE.md: Update querying docs                               ║
║                                                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  [████░░░░░░░░░░░░░░░░] 8/10 to next stage                       ║
║  💡 Run /onboard to choose your creature companion!              ║
║  To undo: git revert {sha}                                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**Progress bar:** 20 chars, █ for filled, ░ for empty

**Also append this banner to the calibration output file** at `brain/outputs/calibrations/{date}-calibration.md`
</rollback_protocol>

<success_criteria>
- [ ] Date filter applied (if provided)
- [ ] Traces collected, individual items extracted
- [ ] Per-item importance ratings assigned
- [ ] Chatroom created, all 3 agents posted -> READY
- [ ] Proposals deduplicated and ranked by importance
- [ ] Calibration proposal document generated
- [ ] User presented with 4-option approval workflow
- [ ] Selected changes applied correctly
- [ ] Traces marked with review_status
- [ ] VERSION file bumped
- [ ] `.claude/stats.yaml` updated with new trace count
- [ ] Single atomic commit created with version in message
- [ ] Evolution banner displayed with level progress
- [ ] Evolution banner appended to calibration output file
</success_criteria>
