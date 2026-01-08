---
name: today
description: "/start Command"
---

<objective>
Aggregate tasks from multiple sources (yesterday's incomplete, inbox, and email) using parallel sub-agents, then synthesize into today's daily note automatically. Routes high-confidence items to Tasks section, defers medium/low to /triage.
</objective>

<essential_principles>
## Orchestrator Architecture

This skill implements a **three-phase orchestrator pattern**:

**Phase 1 - Parallel Gathering:**
Spawn three sub-agents with chatroom coordination:
- Previous Day Agent: Reads yesterday's daily note, extracts incomplete tasks
- Inbox Scanner Agent: Queries brain/inbox/ for critical/overdue/in-progress items
- Email Scanner Agent: Scans Gmail for actionable emails, creates inbox items

**Phase 2 - Synthesis:**
Orchestrator reads chatroom, deduplicates findings, writes directly to daily note without confirmation.

**Phase 3 - Handoff:**
If any medium/low confidence items exist, invoke /triage for human decisions.

### Key Behaviors

**Fully automatic:** No user confirmation before writing daily note. This is a morning workflow that should just work.

**Idempotent:** Email agent checks `source_ref` before creating inbox items. Running /start multiple times won't create duplicate items.

**Confidence routing:**
- `confidence: high` → Goes directly to Tasks section
- `confidence: medium/low` → Deferred to Triage section (handled by /triage)

### State Tracking

Processing state is tracked in `brain/context/processing-state.md`:

```yaml
last_email_scan: 2025-12-28T09:00:00Z  # ISO timestamp
backfill_complete: true                  # Whether 30-day backfill ran
```

On first run, email agent scans 30 days. Subsequently, scans since `last_email_scan`.
</essential_principles>

<quick_start>
## Execution Flow

When /start is invoked:

1. **Read processing state** from `brain/context/processing-state.md`
2. **Create chatroom** at `brain/traces/agents/{date}-start.md`
3. **Spawn sub-agents in parallel:**
   - Previous Day Agent
   - Inbox Scanner Agent
   - Email Scanner Agent
4. **Wait for all agents** to complete
5. **Synthesize results:**
   - Deduplicate items (by source_ref, title similarity)
   - Separate high-confidence from medium/low
6. **Write daily note:**
   - Create/update `brain/notes/daily/{date}.md`
   - High-confidence → Tasks sections
   - Medium/low → Triage section
7. **Update processing state** with new `last_email_scan`
8. **Hand off to /triage** if triage items exist
</quick_start>

<phase_1_parallel>
## Phase 1: Parallel Sub-Agent Spawning

Spawn all three agents in a **single message** for parallel execution. Each agent posts findings to the chatroom.

### Chatroom Setup

Before spawning, create chatroom:
```markdown
brain/traces/agents/{YYYY-MM-DD}-start.md
```

### Spawning Pattern

```
Task(
  subagent_type="general-purpose",
  description="Extract yesterday's incomplete tasks",
  prompt="[Previous Day Agent prompt with chatroom protocol]"
)

Task(
  subagent_type="general-purpose",
  description="Scan inbox for actionable items",
  prompt="[Inbox Scanner Agent prompt with chatroom protocol]"
)

Task(
  subagent_type="general-purpose",
  description="Scan Gmail for action items",
  prompt="[Email Scanner Agent prompt with chatroom protocol]"
)
```

See `references/sub-agents.md` for complete prompt templates.
</phase_1_parallel>

<phase_2_synthesis>
## Phase 2: Synthesis

After all sub-agents complete:

### Read Chatroom

Read the full chatroom at `brain/traces/agents/{date}-start.md` to see:
- What each agent found
- Any cross-agent signals (e.g., email agent confirming inbox item)
- Blockers or empty results

### Deduplicate

Items may appear in multiple sources. Deduplicate by:

1. **source_ref match:** Same Gmail message ID or inbox file path
2. **Title similarity:** Fuzzy match on task titles (same client + similar action)
3. **Entity overlap:** Same person/company + same topic within 48 hours

When duplicates found, keep the most complete version.

### Categorize

**In-System tasks:** Tasks that require Claude Code work (code changes, content creation, system tasks)

**Async tasks:** Tasks requiring external action (calls, emails to send, meetings)

**Triage items:** Medium/low confidence items that need human review

### Write Daily Note

Read `templates/daily-note.md` for merge behavior and section mapping, then read `schemas/vault/daily-note.yaml` for the `example:` block structure. Write directly without confirmation:

```markdown
## Tasks

### In-System
- [ ] {high-confidence task from email/inbox}
- [ ] {incomplete task from yesterday}

### Async
- [ ] {external action item}

### Triage
- [ ] {medium confidence: title} (source: {email|inbox})
- [ ] {low confidence: title} (source: {email|inbox})
```

For triage items, include source to help user understand origin.
</phase_2_synthesis>

<phase_3_handoff>
## Phase 3: Triage Handoff

If any items were placed in the Triage section:

1. **Summarize triage queue:** List the items and their confidence levels
2. **Invoke /triage skill:** Hand off to human decision-making

```
Ready for triage: {n} items need your decision

1. {title} (medium - implied deadline from email)
2. {title} (low - FYI that might need response)

Invoking /triage for human review...
```

If no triage items, skip this phase and complete the command.
</phase_3_handoff>

<email_scanning>
## Email Scanning Logic

The Email Scanner Agent implements the following:

### Timeframe Determination

Read `brain/context/processing-state.md`:

```yaml
last_email_scan: null
backfill_complete: false
```

**If `backfill_complete: false`:**
- Scan last 30 days
- After completion, set `backfill_complete: true`

**If `backfill_complete: true`:**
- Scan since `last_email_scan`
- Typical: last 24-48 hours

### Email Classification

For each email, determine:

1. **Is it actionable?** Direct request, question needing response, deadline mentioned
2. **Confidence level:**
   - `high`: Explicit request ("please send", "can you review"), clear deadline, direct question
   - `medium`: Implied action ("FYI - might want to look at"), suggested deadline
   - `low`: Possibly actionable, unclear intent

### Idempotency Check

Before creating inbox item, check if `source_ref` already exists:

```
grep -r "source_ref: \"msg:{message_id}\"" brain/inbox/
```

If found, skip creation. If not found, create inbox item.

### Inbox Item Creation

Create file at `brain/inbox/{YYYY-MM-DD}-{slug}.md`:

```yaml
---
schema_version: 1.2.0
date: {YYYY-MM-DD}
title: {action title}
status: backlog
source: email
urgency: {normal|high based on deadline}
source_ref: "msg:{gmail_message_id}"
source_url: "https://mail.google.com/mail/u/0/#inbox/{message_id}"
confidence: {high|medium|low}
automated: true
tags: [date/{date}, inbox, source/email]
---

# {action title}

## Description
Email from {sender} on {date}.

{Brief context from email}

## Notes
*Not started*

## Outcome
*Pending*
```
</email_scanning>

<processing_state>
## Processing State Management

### State File Location
`brain/context/processing-state.md`

### State Schema

```yaml
# Email Scan State
last_email_scan: 2025-12-28T09:00:00Z   # ISO timestamp
backfill_complete: true                   # boolean
```

### Update Pattern

After email scan completes:

1. Read current state
2. Set `last_email_scan` to current ISO timestamp
3. If first run, set `backfill_complete: true`
4. Write updated state

```markdown
## Email Scan State

\`\`\`yaml
last_email_scan: {new_timestamp}
backfill_complete: true
\`\`\`
```
</processing_state>

<references_index>
## References

| Reference | Purpose |
|-----------|---------|
| `sub-agents.md` | Complete prompt templates for all three sub-agents |
</references_index>

<templates_index>
## Templates

Templates point to schemas and add skill-specific context:

| Template | Schema | Skill-Specific |
|----------|--------|----------------|
| `daily-note.md` | `schemas/vault/daily-note.yaml` | Merge behavior, section mapping |
| `chatroom.md` | `schemas/vault/chatroom.yaml` | /start agent list, closing format |

**Usage:** Read the template, then read the schema's `example:` block for structure.
</templates_index>

<success_criteria>
Command execution is complete when:
- [ ] Chatroom created for agent coordination
- [ ] All three sub-agents spawned in parallel
- [ ] Sub-agents posted findings to chatroom
- [ ] Results synthesized and deduplicated
- [ ] Daily note written/updated automatically
- [ ] High-confidence items in Tasks sections
- [ ] Medium/low items in Triage section
- [ ] Processing state updated with new timestamp
- [ ] /triage invoked if triage items exist
- [ ] No user confirmation required for daily note writes
</success_criteria>
