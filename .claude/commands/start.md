---
description: Daily task aggregation from inbox, email, and yesterday
---

# /start

Aggregate tasks from yesterday, inbox, and email using parallel sub-agents. Write directly to today's daily note.

## Execute Now

1. **Create chatroom** at `brain/traces/agents/{date}-start.md`

2. **Spawn 3 sub-agents in parallel** (single message):

```
Task(subagent_type="general-purpose", description="Extract yesterday's incomplete tasks", prompt="
You are a task carryover agent. Read brain/notes/daily/{yesterday}.md and extract all unchecked tasks (- [ ]).
Return markdown list under 300 words:
## Carryover
### In-System
- [ ] {tasks requiring Claude Code work}
### Async
- [ ] {external action items}
")

Task(subagent_type="general-purpose", description="Scan inbox for actionable items", prompt="
You are an inbox scanner. List files in brain/inbox/, read frontmatter, find:
- Critical/overdue items (urgency: critical OR due_date < today)
- In-progress items (status: in_progress)
- High urgency due today
Skip status: done/cancelled. Return prioritized list under 400 words.
")

Task(subagent_type="general-purpose", description="Scan emails for action items", prompt="
Scan Gmail for actionable emails and create inbox items.

1. Call mcp__gmail-guMCP-server__read_emails with query='in:inbox category:primary newer_than:30d' and max_results=50
2. For each email, decide: ACTIONABLE or SKIP
   - SKIP: noreply@, notifications@, receipts@, affiliates@, *@rewardful.com, Railway alerts, commission notifications, receipt requests
   - ACTIONABLE: everything else (default to actionable when unsure)
3. For actionable emails, create inbox item at brain/inbox/{date}-{slug}.md

Inbox item format:
---
schema_version: 1.2.0
title: {what needs to be done}
status: backlog
source: email
source_ref: msg:{email_id}
tags: [inbox, source/email]
---
# {title}
From {sender} on {date}: {one line summary}

Return: how many emails scanned, how many actionable, how many inbox items created.
")
```

3. **Wait for all agents**, then synthesize:
   - Dedupe by source_ref or title similarity
   - High confidence → Tasks sections
   - Medium/low → Triage section

4. **Write daily note** at `brain/notes/daily/{date}.md` (no confirmation)

5. **Update** `brain/context/processing-state.md` with new timestamp

6. **If triage items exist**, invoke /triage
