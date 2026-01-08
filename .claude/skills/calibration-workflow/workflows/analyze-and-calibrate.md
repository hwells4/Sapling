<required_reading>
- references/sub-agents.md
</required_reading>

<objective>
Execute the full /calibrate workflow from trace collection through proposal application.
</objective>

<phase_1_context_collection>
## Phase 1: Context Collection

Collect everything the agents need to analyze.

### 1.0 Parse Date Filter (if provided)

If user provided a date argument:
- `2025-12-26` → filter to traces from that date
- `12-26` → assume current year, filter to `2025-12-26`
- No argument → process all unreviewed traces

### 1.1 Gather Traces

Use Glob and Read to collect traces:

```
brain/traces/*.md
```

**Exclude:** `brain/traces/agents/*.md` (chatroom logs, not decision traces)

For each trace file:
1. Read frontmatter
2. **If date filter:** Check if `date` matches filter, skip if not
3. Check if `review_status` is absent, null, or "pending"
4. If unreviewed (and matches date filter), include in list with:
   - File path
   - Date
   - Task/title
   - `target` or `target_skill` or `target_skills` (legacy)
   - `had_human_override` value
   - Whether `## Learnings` section exists

### 1.2 Build System Inventory

Collect paths only (agents read on-demand):

```yaml
skills:
  - .claude/skills/*/SKILL.md
hooks:
  - .claude/hooks/*.py
claude_md:
  - CLAUDE.md
  - brain/CLAUDE.md
  - .claude/CLAUDE.md (if exists)
schemas:
  - schemas/vault/*.yaml
```

### 1.3 Extract Decisions & Learnings

Each trace may contain multiple decisions or learnings. Extract them as separate items:

**From `## Decisions` section:**
- Parse each `### {Decision Title}` block
- Extract: title, AI proposed, chosen, reasoning, pattern tag

**From `## Learnings` section:**
- Parse each bullet point as a separate learning
- Note if it references a skill (e.g., "email-draft skill: ...")

### 1.4 Assess Per-Item Importance

Importance is per-decision/learning, not per-trace:

```python
def assess_item_importance(item, trace_context):
    text = item.content.lower()

    # Critical: explicit failure language in this item
    critical_words = ["fucking", "awful", "terrible", "useless",
                     "complete failure", "completely wrong", "garbage"]
    if any(word in text for word in critical_words):
        return "critical"

    # Critical: trace marked as failure AND this item relates to core issue
    if trace_context.outcome == "failure" and item.is_primary_decision:
        return "critical"

    # High: human override on this specific decision
    if item.had_override or trace_context.had_human_override:
        return "high"

    # High: pattern tag suggests recurring issue
    if item.pattern_tag and pattern_seen_before(item.pattern_tag):
        return "high"

    # Medium: clear actionable learning
    if item.has_trigger or item.references_skill:
        return "medium"

    return "low"
```

### 1.5 Output Context Manifest

Format for agent prompts - show ITEMS not just traces:

```markdown
## Traces to Analyze ({trace_count} traces, {item_count} items)

### Trace: {path}
**Task:** {task}
**Override:** {yes/no}

| # | Type | Title | Importance | Pattern |
|---|------|-------|------------|---------|
| 1 | decision | {title} | {importance} | {pattern or -} |
| 2 | decision | {title} | {importance} | {pattern or -} |
| 3 | learning | {summary} | {importance} | - |

### Trace: {path}
...

## System Inventory

**Skills ({count}):**
{list of skill paths}

**Hooks ({count}):**
{list of hook paths}

**CLAUDE.md files:**
{list of claude.md paths}

**Schemas ({count}):**
{list of schema paths}
```
</phase_1_context_collection>

<phase_2_coordinated_analysis>
## Phase 2: Coordinated Analysis

### 2.1 Create Chatroom

Create chatroom file for agent coordination:

```markdown
---
schema_version: 1.0.0
date: {YYYY-MM-DD}
task: /calibrate analysis
agents: [architecture-strategist, simplicity-advocate, pattern-recognizer]
status: active
---

# Agent Chatroom: /calibrate Analysis

## Coordination Log

## [{HH:MM}] orchestrator
Starting upgrade analysis. {count} traces to review.
Spawning 3 perspective agents.
```

### 2.2 Spawn Agents in Parallel

Use Task tool to spawn all 3 agents simultaneously:

```python
# All in single message for parallel execution
Task(
    subagent_type="general-purpose",
    description="Architecture analysis of traces",
    prompt="""
You are an architecture strategist analyzing decision traces.

PERSPECTIVE: Focus on what's MISSING from the system.

TRACES TO ANALYZE:
{context_manifest}

CHATROOM: {chatroom_path}
Read at start. Post findings. Format: ## [{time}] architecture-strategist

TASKS:
1. Read ALL traces thoroughly
2. Identify gaps that would have prevented issues
3. Check current inventory for coverage
4. Propose new skills, hooks, CLAUDE.md changes
5. Post findings to chatroom
6. Post -> READY when complete

Return structured proposals (see references/sub-agents.md for format).
""",
    run_in_background=True
)

Task(
    subagent_type="general-purpose",
    description="Simplicity analysis of traces",
    prompt="""
You are a simplicity advocate with YAGNI mindset.

PERSPECTIVE: Focus on what should be REMOVED or SIMPLIFIED.

TRACES TO ANALYZE:
{context_manifest}

CHATROOM: {chatroom_path}

[rest of prompt...]
""",
    run_in_background=True
)

Task(
    subagent_type="general-purpose",
    description="Pattern recognition in traces",
    prompt="""
You are a pattern recognizer looking for cross-cutting themes.

PERSPECTIVE: Focus on PATTERNS that span multiple traces.

[rest of prompt...]
""",
    run_in_background=True
)
```

### 2.3 Monitor and Collect

Poll for completion:

1. Wait ~30 seconds
2. Read chatroom to check for `-> READY` signals
3. Use TaskOutput(block=false) to check agent status
4. When all 3 agents post `-> READY`, post `-> CLOSE`
5. Collect final results with TaskOutput(block=true)

### 2.4 Handle Failures

If an agent crashes:
- Post to chatroom: `@{agent} crashed: {error}`
- Continue with available results
- Note incomplete analysis in proposal
</phase_2_coordinated_analysis>

<phase_3_proposal_generation>
## Phase 3: Proposal Generation

### 3.1 Parse Agent Results

Each agent returns structured proposals. Parse into unified format:

```python
proposals = []
for agent_result in [arch_result, simp_result, pattern_result]:
    for proposal in parse_proposals(agent_result):
        proposals.append({
            "target": proposal.target,
            "title": proposal.title,
            "issue": proposal.issue,
            "source_traces": proposal.traces,
            "proposed_by": agent_result.agent_name,
            "importance": proposal.importance,
            "change": proposal.change_content
        })
```

### 3.2 Deduplicate

Multiple agents may identify the same issue:

```python
# Group by target + similar title
grouped = group_by_similarity(proposals)

for group in grouped:
    if len(group) > 1:
        # Merge: take highest importance, combine source traces
        merged = {
            "target": group[0].target,
            "title": group[0].title,
            "importance": max(p.importance for p in group),
            "source_traces": union(p.source_traces for p in group),
            "proposed_by": [p.proposed_by for p in group],
            "change": group[0].change  # or merge if compatible
        }
```

### 3.3 Extract Learnings-Only

Some insights can't be codified:

```python
learnings_only = []
for trace in traces:
    if "## Learnings" in trace.content:
        learnings = extract_learnings_section(trace)
        for learning in learnings:
            if not any(p.references_learning(learning) for p in proposals):
                learnings_only.append(learning)
```

### 3.4 Classify Proposal Size

Proposals fall into two categories:

**Direct changes (apply in calibration):**
- Edit existing skill
- Add to CLAUDE.md
- Modify hook
- Update schema

**Inbox items (too big for calibration):**
- Create new skill
- Create new hook
- Major architectural changes

```python
direct_proposals = []
inbox_proposals = []

for proposal in proposals:
    if proposal.target.startswith("skill:new:") or \
       proposal.target.startswith("hook:new:") or \
       proposal.requires_major_work:
        inbox_proposals.append(proposal)
    else:
        direct_proposals.append(proposal)
```

**For inbox proposals, create inbox items:**
```python
for proposal in inbox_proposals:
    Write(f"brain/inbox/{date}-calibrate-{slugify(proposal.title)}.md", f"""---
schema_version: 1.0.0
type: task
source: calibrate
status: pending
urgency: {proposal.importance}
tags:
  - date/{date}
  - source/calibrate
  - topic/skills
---

# {proposal.title}

**From calibration:** {date}
**Source traces:** {proposal.source_traces}
**Proposed by:** {proposal.proposed_by}

## Context

{proposal.issue}

## Suggested approach

{proposal.change}

## Next step

Run `/create-skill {proposal.skill_name}` to implement.
""")
```

### 3.5 Generate Output Document

Create `brain/outputs/calibrations/{date}-upgrade.md`:

```markdown
---
schema_version: 1.0.0
date: {date}
type: calibration
status: pending
traces_processed: {count}
direct_proposals: {direct_count}
inbox_proposals: {inbox_count}
tags:
  - date/{date}
  - output/calibration
  - status/pending
---

# Calibration Proposal: {date}

| Category | Count |
|----------|-------|
| Direct changes | {direct_count} |
| New skills (→ inbox) | {inbox_count} |
| Learnings only | {learnings_count} |

---

## DIRECT CHANGES (apply now)

### CRITICAL
{direct proposals with importance=critical}

### HIGH
{direct proposals with importance=high}

### MEDIUM
{direct proposals with importance=medium}

### LOW
{direct proposals with importance=low}

---

## NEW SKILLS NEEDED (→ inbox)

These are too big for calibration. Inbox items created for each:

{for each inbox_proposal:}
### {title}
**Urgency:** {importance}
**Source traces:** {traces}
**Inbox item:** `brain/inbox/{date}-calibrate-{slug}.md`
**Next step:** `/create-skill {skill_name}`

---

## LEARNINGS ONLY (no code change)

{learnings_only list}
```
</phase_3_proposal_generation>

<phase_4_approval>
## Phase 4: Human Approval

### 4.1 Present Summary and Changes

First, show what was found:

```
CALIBRATION ANALYSIS COMPLETE

Traces analyzed:        {trace_count}
Items extracted:        {item_count}

DIRECT CHANGES ({direct_count})
  CRITICAL: {n}
  HIGH:     {n}
  MEDIUM:   {n}
  LOW:      {n}

NEW SKILLS NEEDED ({inbox_count})
  → Inbox items created for each
  → Run /create-skill after calibration

LEARNINGS ONLY ({learnings_count})
  → No code changes, just insights
```

**IMPORTANT: Always show all proposed changes BEFORE asking for user input.**

Then, display ALL direct proposals with their actual content:

```markdown
## Proposed Changes

### CRITICAL

**1. {target}: {title}**
Source traces: {trace_paths}
Proposed by: {agent_name}

Issue: {issue_description}

Change:
```{language}
{actual_change_content}
```

---

### HIGH

**2. {target}: {title}**
...

### MEDIUM

**3. {target}: {title}**
...

### LOW

**4. {target}: {title}**
...

---

## Inbox Items Created

{For each inbox_proposal:}
- `brain/inbox/{date}-calibrate-{slug}.md` - {title}

---

## Learnings Only (no code change)

{learnings_only list}
```

### 4.2 Ask for Approval

After showing all changes, use AskUserQuestion:

```python
AskUserQuestion(
    questions=[{
        "question": "What would you like to do with these changes?",
        "header": "Calibration",
        "options": [
            {
                "label": "Apply all & commit",
                "description": f"Apply all {direct_count} direct changes and commit"
            },
            {
                "label": "Select specific changes",
                "description": "Choose which proposals to apply by number"
            },
            {
                "label": "Cancel",
                "description": "No direct changes applied (inbox items still created)"
            }
        ],
        "multiSelect": False
    }]
)
```

### 4.3 Handle Selection

**If "Select specific changes":**

```python
AskUserQuestion(
    questions=[{
        "question": "Which changes to apply? Enter numbers",
        "header": "Select",
        "options": [
            {"label": "Critical only", "description": f"Apply proposals 1-{critical_count}"},
            {"label": "Critical + High", "description": f"Apply proposals 1-{critical_high_count}"},
            {"label": "All except LOW", "description": f"Skip simplifications"},
            # User can also provide custom input via "Other"
        ],
        "multiSelect": False
    }]
)
```
</phase_4_approval>

<phase_5_application>
## Phase 5: Application

### 5.1 Apply Changes

For each selected proposal:

**Editing existing file:**
```python
# Read current content
content = Read(proposal.target_path)

# Apply change
if proposal.change_type == "append":
    new_content = content + "\n" + proposal.change
elif proposal.change_type == "replace_section":
    new_content = replace_section(content, proposal.section, proposal.change)
elif proposal.change_type == "insert_after":
    new_content = insert_after(content, proposal.anchor, proposal.change)

# Write updated content
Edit(proposal.target_path, old=section, new=proposal.change)
```

**Creating new file:**
```python
Write(proposal.target_path, proposal.change)
```

### 5.2 Mark Traces

For each trace that contributed to applied proposals:

```python
# Read trace
trace_content = Read(trace_path)

# Update frontmatter
updated = update_frontmatter(trace_content, {
    "review_status": "applied",
    "applied_to": [list of files changed]
})

Edit(trace_path, old=original_frontmatter, new=updated_frontmatter)
```

For skipped traces:
```python
updated = update_frontmatter(trace_content, {
    "review_status": "skipped"
})
```

### 5.3 Update Proposal Status

```python
Edit(proposal_doc_path,
     old="status: pending",
     new=f"status: applied\napplied_at: {datetime.now().isoformat()}")
```

### 5.4 Bump OS Version

Read current version from `VERSION` file and bump based on changes:

```python
def bump_version(current, proposals):
    major, minor, patch = map(int, current.strip().split('.'))

    # Minor bump: new skills or hooks created
    if any(p.creates_new_component for p in proposals):
        return f"{major}.{minor + 1}.0"

    # Patch bump: modifications to existing components
    return f"{major}.{minor}.{patch + 1}"

# Read current version
current_version = Read("VERSION").strip()

# Calculate new version
new_version = bump_version(current_version, applied_proposals)

# Update VERSION file
Write("VERSION", new_version + "\n")
```

### 5.5 Create Atomic Commit

```bash
git add .

git commit -m "$(cat <<'EOF'
calibrate(v{new_version}): Apply {n} improvements from {m} traces

Version: {old_version} → {new_version}

Proposals applied:
- {target}: {title}
- {target}: {title}
...

Traces marked as reviewed:
- {trace-1}
- {trace-2}
...

To rollback: git revert HEAD

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 5.6 Show Calibration Complete

```
╔════════════════════════════════════════════════════════════╗
║                   CALIBRATION COMPLETE                     ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   Version: {old_version} → {new_version}                   ║
║   Proposals applied: {n}                                   ║
║   Traces reviewed: {m}                                     ║
║   Commit: {sha}                                            ║
║                                                            ║
║   Your system is now calibrated to your preferences.       ║
║                                                            ║
║   To undo: git revert {sha}                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```
</phase_5_application>

<success_criteria>
- [ ] Phase 1: Date filter applied (if provided), traces collected, items extracted with per-item importance
- [ ] Phase 2: Chatroom created, all agents posted -> READY
- [ ] Phase 3: Proposals deduplicated, ranked, document generated
- [ ] Phase 4: User presented 4 options, selection captured
- [ ] Phase 5: Selected edits applied, traces marked, VERSION bumped, commit created
- [ ] "CALIBRATION COMPLETE" display shown with version change and rollback instructions
</success_criteria>
