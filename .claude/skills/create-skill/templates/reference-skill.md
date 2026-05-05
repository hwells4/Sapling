# Reference Skill Template

Use for domain expertise skills with progressive disclosure. SKILL.md max 100 lines (index only).

---

## Directory Structure

```
{skill-name}/
├── SKILL.md                    # Index only (~100 lines)
└── resources/
    ├── patterns/
    │   ├── README.md           # Pattern selector
    │   ├── {pattern-1}.md
    │   └── {pattern-2}.md
    ├── workflows/
    │   └── {common-task}.md
    └── reference/
        └── {api-details}.md
```

---

## SKILL.md Template (Index Only)

```markdown
---
name: {skill-name}
description: {Domain} patterns and best practices. Use when working with {domain} or {related tasks}.
context_budget:
  skill_md: 100
  max_references: 6
---

<objective>
Provide {domain} expertise through progressive disclosure.
Load only the resources needed for the current task.
</objective>

<when_to_use>
- Working with {domain/tool/API}
- Need {specific pattern}
- Troubleshooting {common issues}
</when_to_use>

<quick_start>
1. Identify what you need (pattern, workflow, or reference)
2. Navigate to relevant resource
3. Apply the guidance
</quick_start>

<navigation>
**For patterns:** Start with resources/patterns/README.md

**For workflows:** See resources/workflows/

**For API details:** See resources/reference/
</navigation>

<resources_index>
| Resource | Purpose |
|----------|---------|
| resources/patterns/README.md | Pattern selector - start here |
| resources/patterns/{pattern-1}.md | {Brief description} |
| resources/patterns/{pattern-2}.md | {Brief description} |
| resources/workflows/{task}.md | {Brief description} |
| resources/reference/{details}.md | {Brief description} |
</resources_index>

<golden_rules>
{3-5 rules that ALWAYS apply, kept brief}
1. {Rule 1}
2. {Rule 2}
3. {Rule 3}
</golden_rules>
```

---

## Pattern Selector Template

Create `resources/patterns/README.md`:

```markdown
# {Domain} Patterns

Select the pattern that matches your task.

| Pattern | Use When |
|---------|----------|
| {pattern-1}.md | {Trigger condition} |
| {pattern-2}.md | {Trigger condition} |
| {pattern-3}.md | {Trigger condition} |

## Pattern Descriptions

### {Pattern 1}
{2-3 sentence description}
→ Read: patterns/{pattern-1}.md

### {Pattern 2}
{2-3 sentence description}
→ Read: patterns/{pattern-2}.md

### {Pattern 3}
{2-3 sentence description}
→ Read: patterns/{pattern-3}.md
```

---

## Individual Pattern Template

Create `resources/patterns/{pattern-name}.md`:

```markdown
# {Pattern Name}

## When to Use
{Conditions when this pattern applies}

## The Pattern

{Core approach in 3-5 steps}

1. {Step 1}
2. {Step 2}
3. {Step 3}

## Example

{Concrete example with code/commands}

```{language}
{example code}
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| {Mistake 1} | {Fix 1} |
| {Mistake 2} | {Fix 2} |

## Related
- {Link to related pattern}
- {Link to relevant reference}
```

---

## Example: attio-mcp-usage Structure

```
attio-mcp-usage/
├── SKILL.md                          # 80 lines - just index
└── resources/
    ├── patterns/
    │   ├── README.md                 # Pattern selector
    │   ├── search-records.md         # Search pattern
    │   ├── create-update.md          # CRUD pattern
    │   ├── batch-operations.md       # Batch pattern
    │   └── filter-lists.md           # List filtering
    ├── workflows/
    │   ├── find-company.md           # Common workflow
    │   └── update-deal-stage.md      # Common workflow
    └── reference/
        ├── tool-reference.md         # All MCP tools
        └── field-types.md            # Attio field types
```

SKILL.md loads: ~80 lines (~800 tokens)
User needs search pattern: loads search-records.md (~200 lines)
Total: ~280 lines vs loading everything (~1500+ lines)
