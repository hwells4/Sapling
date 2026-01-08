# Daily Note Template

**Schema:** `schemas/vault/daily-note.yaml`

Read the schema's `example:` block for the complete template structure.

## Merge Behavior

When updating an existing daily note:

1. **Preserve Focus section** - don't overwrite user's decision
2. **Merge tasks** - add new items, don't remove existing
3. **Preserve checkmarks** - if user checked something, keep it
4. **Append triage items** - add new ones to existing list
5. **Preserve reflection** - don't touch evening section

## Section Mapping

| Source | Target Section |
|--------|----------------|
| Previous day incomplete (in-system) | ### In-System |
| Previous day incomplete (async) | ### Async |
| Inbox item (confidence: high, in-system work) | ### In-System |
| Inbox item (confidence: high, async work) | ### Async |
| Inbox item (confidence: medium/low) | ### Triage |
| Email item (confidence: high, in-system) | ### In-System |
| Email item (confidence: high, async) | ### Async |
| Email item (confidence: medium/low) | ### Triage |

## Task Formatting

**Standard task:**
```markdown
- [ ] Review contract changes from Sarah
```

**Task with source (for triage items):**
```markdown
- [ ] Review contract changes from Sarah (source: email)
```

**Task with entity link (when known):**
```markdown
- [ ] Send proposal to [[entities/todd-ablowitz|Todd]] (due: Dec 30)
```
