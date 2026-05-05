# XML Structure Best Practices

Use pure XML blocks instead of markdown headings for 25% token savings.

## Basic Structure

```xml
<section_name>
Content goes here.
Multiple lines are fine.
</section_name>
```

## Required Sections

Every skill must have:

```xml
<objective>
Clear goal statement - what this skill accomplishes.
Keep under 10 lines.
</objective>

<quick_start>
Minimal path to common use case.
Keep under 20 lines.
</quick_start>

<success_criteria>
- [ ] Checkbox format
- [ ] Measurable outcomes
- [ ] How to know it worked
</success_criteria>
```

## Optional Sections

```xml
<essential_principles>
Critical content that must always load.
Keep inline in SKILL.md.
</essential_principles>

<intake>
Question to determine user intent.
Used for routing.
</intake>

<routing>
| Intent | Workflow |
|--------|----------|
| Do X | workflows/do-x.md |
| Do Y | workflows/do-y.md |
</routing>

<process>
Step-by-step instructions.
Include freedom level markers if helpful.
</process>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/foo.md | Brief description |
</references_index>

<templates_index>
| Template | Use For |
|----------|---------|
| templates/bar.md | Brief description |
</templates_index>
```

## Workflow-Specific Sections

```xml
<required_reading>
- references/always-needed.md
- references/for-this-workflow.md
</required_reading>

<when_to_use>
Conditions when this workflow applies.
</when_to_use>

<key_pattern>
Important pattern or insight for this workflow.
</key_pattern>
```

## Why Not Markdown?

**Markdown headings:**
```markdown
## Objective

Clear goal statement.

## Process

Step-by-step instructions.
```

**Problems:**
- More tokens (## + space + title + newlines)
- Ambiguous boundaries (where does section end?)
- Requires inference to parse
- Inconsistent across skills

**XML blocks:**
```xml
<objective>
Clear goal statement.
</objective>

<process>
Step-by-step instructions.
</process>
```

**Benefits:**
- Fewer tokens (~25% savings)
- Unambiguous start/end
- Direct parsing
- Consistent structure

## Nesting

Avoid deep nesting. One level is fine:

```xml
<process>
1. First step
   - Sub-point
   - Sub-point

2. Second step
</process>
```

Don't nest XML blocks:

```xml
<!-- Bad -->
<process>
  <step1>
    Do something
  </step1>
</process>

<!-- Good -->
<process>
1. Do something
2. Do something else
</process>
```

## Tables in XML

Tables work fine inside XML blocks:

```xml
<routing>
| Intent | Workflow |
|--------|----------|
| Create | workflows/create.md |
| Update | workflows/update.md |
</routing>
```

## Code Blocks in XML

Also fine:

```xml
<process>
Run this command:

```bash
git add -A
```

Then continue.
</process>
```

## Validation

Check your XML:
- [ ] Every `<tag>` has matching `</tag>`
- [ ] No markdown headings (## etc.) in skill body
- [ ] Frontmatter uses YAML (that's fine)
- [ ] Sections are properly closed before next opens
