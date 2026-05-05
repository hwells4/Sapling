---
description: Start tracked work with beads
argument-hint: [task description]
---

# /task Command

Wrapper that adds lightweight planning and beads persistence to larger tasks.

## Task: $ARGUMENTS

---

## Phase 1: Assess

**Announce:** "Task: {$ARGUMENTS}"

**Determine complexity:**

| Indicator | Points |
|-----------|--------|
| Multi-step work (3+ distinct actions) | +1 |
| Unknown scope (research, exploration) | +1 |
| Multiple data sources to consult | +1 |
| Could span multiple sessions | +1 |

**Score 0-1:** Simple task → Skip to Phase 3 (Execute)
**Score 2+:** Complex task → Proceed to Phase 2 (Plan)

---

## Phase 2: Plan (Complex Tasks Only)

### 2.1 Skill Scan

Check if existing skills handle this task:

| Skill | Triggers On |
|-------|-------------|
| `onboard` | "set up", "first run", "configure hooks" |
| `generate-prd` | "PRD", "spec", "requirements" |
| `generate-stories` | "break this down", "create stories" |
| `github` | GitHub repository operations |

**If skill matches:** Invoke that skill. It handles its own workflow. Skip remaining phases.

### 2.2 Decompose

If no skill matches, break down the work:

1. **Identify sub-tasks** — What are the distinct pieces of work?
2. **Identify dependencies** — What must complete before what?

### 2.3 Create Beads

Register each sub-task with beads for persistence:

```bash
bd create "Sub-task 1: {description}"
bd create "Sub-task 2: {description}" --after {id-of-task-1}  # if dependent
```

**Show the plan to user:**
```
Plan:
1. [bead-id] Sub-task 1
2. [bead-id] Sub-task 2 (depends on 1)
3. [bead-id] Sub-task 3

Proceed? (y/n)
```

Wait for confirmation before executing.

---

## Phase 3: Execute

### Simple Tasks (Score 0-1)
Just do the work. No ceremony needed.

### Complex Tasks (Score 2+)

Work through beads in order:
```bash
bd ready {id}     # Mark starting
# ... do the work ...
bd close {id}     # Mark complete
```

**If blocked:** `bd block {id} "reason"` — captures why for session recovery.

**If sub-task discovered:** `bd create "New sub-task"` — add to plan dynamically.

---

## Phase 4: Outputs

When creating files in `brain/outputs/`, derive entity tags from frontmatter:

```yaml
# If frontmatter has:
people: ["[[entities/jane-smith]]"]
companies: ["[[entities/brown-robin]]"]

# Then tags MUST include:
tags:
  - person/jane-smith
  - company/brown-robin
```

---

## Phase 5: Complete

When all work is done:

1. **Verify beads closed** (if used):
   ```bash
   bd list  # Should show no open beads for this task
   ```

2. **Create output files** for external deliverables (Gmail drafts, sent emails, etc.)

3. **Invoke `/commit`** — atomic commit with message `task: {description}`

---

## Session Recovery

If context resets mid-task:

```bash
bd list     # Shows open beads
```

Resume from where you left off. Beads persist across sessions.
