# Chatroom Template

**Schema:** `schemas/vault/chatroom.yaml`

Read the schema's `example:` block for the complete template structure.

## /start Specifics

**File location:** `brain/traces/agents/{YYYY-MM-DD}-start.md`

**Agents:** `[previous-day, inbox-scanner, email-scanner]`

**Task description:** `Daily task aggregation for {date}`

## Closing the Chatroom

After synthesis completes, update status to `completed` and add final entry:

```markdown
## [{HH:MM}] orchestrator
All agents complete. Synthesis finished.
- Carried forward: {n} tasks from yesterday
- From inbox: {n} items
- From email: {n} new items created ({h} high, {m} medium, {l} low)
- Total tasks added to daily note: {total}
- Triage items: {triage_count}

Chatroom closed.
```
