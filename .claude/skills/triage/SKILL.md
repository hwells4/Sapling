---
name: triage
description: Process items needing human decision one at a time. Serves inbox items with medium/low confidence, unclassified calls, and stale items. Use after /today_2 or standalone for inbox review.
---

<objective>
Present items requiring human decision one at a time. Capture decisions, update items, and track progress until queue is empty.
</objective>

<quick_start>
1. Query inbox for triage items
2. Present first item with context and options
3. Capture user decision
4. Update item (status, classification, urgency)
5. Repeat until queue empty
6. Show summary of decisions made
</quick_start>

<triage_criteria>
Items enter triage when ANY of:
- `confidence: medium|low` (email agent uncertainty)
- Source is `call` and needs classification
- `status: backlog` AND created > 7 days ago (stale)
- Explicitly marked for triage by other processes
</triage_criteria>

<query>
```
Glob: brain/inbox/*.md
Filter by frontmatter:
  - confidence IN [medium, low] OR
  - (source = call AND triage_needed = true) OR
  - (status = backlog AND created_date < today - 7 days)

Sort: urgency ASC, created_date ASC
```
</query>

<item_presentation>
For each item, present:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Triage: {current}/{total}

**{item.title}**
Source: {item.source} | Created: {item.date}
{if entity}Entity: {item.entity}{/if}
{if due_date}Due: {item.due_date}{/if}

{item.description excerpt - first 3 lines}

{if source == email}
From: {sender}
Confidence: {confidence} - {confidence_reason}
{/if}

{if source == call}
Attendees: {attendees}
Best guess: {classification_guess}
{/if}

Options:
{dynamic options based on item type}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</item_presentation>

<option_sets>
**For email items (medium/low confidence):**
1. Add to tasks (confirm actionable)
2. Archive (not actionable)
3. Respond now (opens email context)
4. Defer (set due date)
5. Skip for now

**For call classification:**
1. Create new client entity
2. Assign to existing client: {suggestions}
3. Mark as personal/internal
4. Create partner entity
5. Skip for now

**For stale items:**
1. Still relevant - update urgency
2. Done - mark complete
3. No longer needed - cancel
4. Defer - set new due date
5. Skip for now
</option_sets>

<decision_handling>
Based on user selection:

**"Add to tasks":**
- Update: `confidence: high`, `status: backlog`
- Remove from triage criteria

**"Archive":**
- Update: `status: cancelled`
- Add note: "Archived during triage - not actionable"

**"Create new client":**
- Prompt for client name
- Create entity at `brain/entities/{slug}.md`
- Update inbox item: `entity: [[entities/{slug}]]`
- Move call file to `brain/calls/`
- **Extract action items** (see `<call_action_extraction>` below)

**"Assign to existing client":**
- Update inbox item: `entity: [[entities/{selected-slug}]]`
- Move call file to `brain/calls/`
- **Extract action items** (see `<call_action_extraction>` below)

**"Create partner entity":**
- Prompt for partner name
- Create entity at `brain/entities/{slug}.md` with `status: partner`
- Update inbox item: `entity: [[entities/{slug}]]`
- Move call file to `brain/calls/`
- **Extract action items** (see `<call_action_extraction>` below)

**"Mark as personal/internal":**
- Move call file to `brain/calls/` with `classification_type: internal`
- No entity link needed
- **Extract action items** (still extract Harrison's todos)

**"Mark complete":**
- Update: `status: done`, `completed_date: {today}`

**"Defer":**
- Prompt for new due date
- Update: `due_date: {new_date}`

**"Skip":**
- No changes
- Item remains in triage for next run
</decision_handling>

<progress_tracking>
After each decision:
```
"{item.title}" → {action taken}

{remaining} items remaining. Continue? [Y/n/jump to #]
```

Allow user to:
- Continue to next item
- Stop and save progress
- Jump to specific item number
</progress_tracking>

<completion_summary>
When queue empty or user stops:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Triage Complete

Processed: {n}/{total}
- Added to tasks: {n}
- Archived: {n}
- Completed: {n}
- Deferred: {n}
- Skipped: {n}
- New entities created: {n}

{if skipped > 0}
{skipped} items remain in triage for next run.
{/if}

Your top 3 priorities for today:
1. {priority_1}
2. {priority_2}
3. {priority_3}

Ready to work. Run /task to start your first priority.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</completion_summary>

<call_action_extraction>
When saving a call to the system (assigning to entity), extract Harrison's action items:

1. **Read the call file** from `brain/inbox/calls/` or the triage location
2. **Extract action items** from the call notes:
   - Look for "Action Items", "Next Steps", "Follow-ups" sections
   - Look for bullet points with action verbs (send, schedule, follow up, review, etc.)
   - Identify owner: Harrison-owned items only
3. **For each Harrison item, create inbox file** at `brain/inbox/YYYY-MM-DD-{slug}.md`:

```yaml
---
schema_version: 1.2.0
date: {call_date}
title: {action item text}
status: backlog
source: call
source_ref: "[[calls/{call-filename}]]"
entity: "[[entities/{entity-slug}]]"
urgency: {normal|high based on deadline}
due_date: {if mentioned, ISO format}
automated: false
confidence: high
tags:
  - date/{call_date}
  - inbox
  - source/call
  - client/{entity-slug}
---

# {action item text}

## Description

Action item from call with {entity name} on {date}.

**Source:** [[calls/{call-filename}]]

## Notes

*Not started*

## Outcome

*Pending*
```

4. **Skip if action items already exist** - check `brain/inbox/` for items with same `source_ref`

5. **Commit all files together** using `/commit` or:
   ```bash
   git add brain/calls/{call-file}.md brain/inbox/*.md brain/entities/{entity}.md
   git commit -m "feat(calls): add {entity} call - {topic}

   Triage resolution: {action taken}
   Inbox items: {count}"
   git push origin main
   ```
</call_action_extraction>

<entity_decision_tree>
When classifying relationship type during triage:

| Relationship | Action | Rationale |
|--------------|--------|-----------|
| **Prospect (light)** | Attio only, no vault entity | Low-touch lead, CRM is source of truth |
| **Prospect (substantive)** | Full vault entity | Multiple interactions, worth tracking context |
| **Candidate** | Entity with status tracking | Evaluating for hire/partnership |
| **Client** | Entity + Linear project | Active engagement, needs project management |
| **Partner** | Entity with `status: partner` | Ongoing collaboration relationship |

**Detection heuristics:**
- Mentions pricing/proposal → prospect
- Multiple scheduled calls → substantive prospect
- Interview/evaluation context → candidate
- Signed/active work → client
- Integration/referral context → partner
</entity_decision_tree>

<entity_creation>
When creating new entity from triage:

```yaml
---
schema_version: 1.0.0
name: "{entity name}"
type: company
status: client
created: {today}
source: triage
tags: [entity, company, client/{slug}]
---

# {Entity Name}

## Overview
Created during triage from {source} on {date}.

## Contacts
*To be added*

## Notes
{Any context from the triaged item}
```

Then update the original inbox/call item to link to new entity.
</entity_creation>

<success_criteria>
- [ ] Triage items queried and counted
- [ ] Each item presented with full context
- [ ] User decision captured for each processed item
- [ ] Items updated based on decisions
- [ ] New entities created when requested
- [ ] Progress shown after each decision
- [ ] Summary displayed on completion
- [ ] Top priorities surfaced for next action
</success_criteria>
