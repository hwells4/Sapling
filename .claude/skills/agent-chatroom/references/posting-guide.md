# Agent Chatroom Posting Guide

Quick reference for how agents participate in the chatroom.

## Philosophy

> This is a shared space for agents to coordinate. Use it naturally.

The chatroom serves two purposes:
1. **Live:** Agents coordinate, share findings, adapt to each other
2. **Later:** Humans review to understand what happened and improve the system

## Coordination Signals (Required)

Post these signals when finishing or blocked:

| Signal | Meaning |
|--------|---------|
| `→ READY` | You completed your work |
| `→ WAITING @agent` | You need input from another agent |
| `→ BLOCKED: reason` | External issue (API, data, etc.) |
| `→ CLOSE` | **Orchestrator only** - all agents may stop |

**Important:** A SubagentStop hook enforces these signals. You cannot stop until:
1. You post a signal (READY/WAITING/BLOCKED)
2. Orchestrator posts → CLOSE

## When to Post

Post what feels relevant. Trust your judgment. Examples:
- What you're starting to do
- What you found (expected or unexpected)
- Something another agent should know
- A question or need
- Confirmation of another's finding
- How you're adapting based on others
- **Your completion status** (→ READY)

## Post Format

```markdown
## [{HH:MM}] {agent-name}
{What you discovered or decided - 1-2 sentences}
→ @{target-agent} {what they should do or know}
→ {SIGNAL}
```

## Event Types

### Discovery
Found something unexpected that affects the task.
```markdown
## [14:31] linear-status
No Linear project found for Acme Corp.
→ @email-history dig deeper for activity context
```

### Blocker
Hit an obstacle that needs resolution.
```markdown
## [14:32] email-history
Gmail API rate limited. Cannot fetch emails.
→ @orchestrator proceed without email context?
```

### Confirmation
Validating another agent's finding.
```markdown
## [14:33] attio-loader
Deal marked "At Risk" 3 days ago.
→ confirms @email-history frustration signal
```

### Adaptation
Changing approach based on others' discoveries.
```markdown
## [14:34] voice-context
@email-history noted frustration. Adjusting tone: empathetic opening.
→ @orchestrator tone guidance updated
```

### Handoff
Ready for another agent to proceed.
```markdown
## [14:35] research-agent
Competitor analysis complete: brain/research/competitors.md
→ @draft-agent ready for your pass
```

## Target Audience

Use @mentions to direct information:

| Mention | When to use |
|---------|-------------|
| @orchestrator | Blockers, key context, confirmations |
| @{specific-agent} | They need this to do their job |
| (no mention) | General context for anyone reading |

## Volume

There's no target number of posts. Some tasks will have lots of coordination, others very little. Both are fine.

The chatroom should tell the story of what happened during the task - whatever that looks like.
