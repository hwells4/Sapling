# /triage Command

Process inbox items needing human decision, one at a time.

## Usage
```
/triage
```

## What This Command Does

Invokes the `triage` skill which:

1. **Queries inbox** for items needing triage:
   - Medium/low confidence (from email agent)
   - Unclassified calls
   - Stale items (>7 days old)

2. **Presents items one at a time** with:
   - Full context and source
   - Confidence reasoning (for email items)
   - Classification suggestions (for calls)
   - Action options

3. **Captures decisions** and updates items:
   - Add to tasks (upgrade confidence)
   - Archive (mark cancelled)
   - Create entity (for call classification)
   - Defer (set due date)
   - Complete (mark done)

4. **Shows progress** after each decision

5. **Summarizes on completion**:
   - Decisions made by category
   - Remaining items (if skipped)
   - Top 3 priorities

## When to Use

- After `/today_2` when triage items exist
- Standalone for inbox review
- Weekly to clear stale items

## Skill Location
`.claude/skills/triage/SKILL.md`
