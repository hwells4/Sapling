# Router Skill Template

Use for skills with multiple workflows and shared references. SKILL.md max 200 lines.

---

## Directory Structure

```
{skill-name}/
├── SKILL.md              # Router (max 200 lines)
├── workflows/
│   ├── {workflow-1}.md
│   └── {workflow-2}.md
├── references/
│   └── {shared-knowledge}.md
└── templates/            # Optional
    └── {output-format}.md
```

---

## SKILL.md Template

```markdown
---
name: {skill-name}
description: {What it does}. Use when {triggers}. {Third person}
context_budget:
  skill_md: 200
  max_references: {number}
---

<objective>
{Clear goal statement}
</objective>

<essential_principles>
{Critical content that must always load}
{Cannot be skipped - that's why it's inline}
</essential_principles>

<quick_start>
{Minimal path to most common use}
1. {Step}
2. {Step}
3. {Step}
</quick_start>

<intake>
What would you like to do?

1. **{Option 1}** → workflows/{workflow-1}.md
2. **{Option 2}** → workflows/{workflow-2}.md
3. **{Option 3}** → workflows/{workflow-3}.md

Ask the user or infer from their request.
</intake>

<routing>
| User Intent | Workflow |
|-------------|----------|
| {Intent 1} | workflows/{workflow-1}.md |
| {Intent 2} | workflows/{workflow-2}.md |
| {Intent 3} | workflows/{workflow-3}.md |
</routing>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/{ref-1}.md | {Brief description} |
| references/{ref-2}.md | {Brief description} |
</references_index>

<templates_index>
| Template | Use For |
|----------|---------|
| templates/{template-1}.md | {Brief description} |
</templates_index>

<success_criteria>
- [ ] {General outcome 1}
- [ ] {General outcome 2}
</success_criteria>
```

---

## Workflow File Template

```markdown
<required_reading>
- references/{always-needed}.md
- references/{for-this-workflow}.md
</required_reading>

<objective>
{What this specific workflow accomplishes}
</objective>

<when_to_use>
{Conditions when this workflow applies}
</when_to_use>

<process>
1. **{Step}** [{freedom level}]
   {Instructions}

2. **{Step}** [{freedom level}]
   {Instructions}

3. **{Step}** [{freedom level}]
   {Instructions}
</process>

<success_criteria>
- [ ] {Workflow-specific outcome 1}
- [ ] {Workflow-specific outcome 2}
</success_criteria>
```
