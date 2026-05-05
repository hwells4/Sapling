# Validation Checklist

Run through this before completing any skill.

## Structure Validation

### Frontmatter
- [ ] `name` is lowercase-with-hyphens
- [ ] `name` matches directory name
- [ ] `description` is third person
- [ ] `description` includes "what it does AND when to use it"
- [ ] `context_budget` is declared

### SKILL.md
- [ ] Under line limit for archetype (150/200/100)
- [ ] Uses pure XML structure (no ## headings)
- [ ] Has `<objective>` section
- [ ] Has `<quick_start>` section
- [ ] Has `<success_criteria>` with checkboxes

### For Router Skills
- [ ] Has `<intake>` or `<routing>` section
- [ ] Has `<references_index>` if references exist
- [ ] Has `<workflows_index>` if multiple workflows

### For Orchestrator Skills
- [ ] `references/sub-agents.md` exists
- [ ] Each sub-agent has word limit
- [ ] Parallel spawning where possible

## Content Validation

### Conciseness
- [ ] Each section justifies its token cost
- [ ] No content Claude already knows
- [ ] Domain knowledge in references, not inline

### Freedom Levels
- [ ] Creative tasks have high freedom (principles)
- [ ] Standard work has medium freedom (patterns)
- [ ] Fragile operations have low freedom (scripts)

### References
- [ ] Each under 300 lines
- [ ] Self-contained (no dependencies)
- [ ] One level deep (direct links from SKILL.md)
- [ ] Indexed in SKILL.md

### Workflows
- [ ] Each has `<required_reading>` block
- [ ] Each has `<success_criteria>`
- [ ] Process steps are clear

## AI-ism Check (for content skills)

If the skill generates content, check for:

- [ ] No em dashes (—)
- [ ] No "Here's the thing:"
- [ ] No "Let me be clear:"
- [ ] No "In today's fast-paced world..."
- [ ] No rule-of-three lists everywhere
- [ ] No "It's important to note that..."
- [ ] No "At the end of the day..."
- [ ] Matches voice reference if exists

## Final Checks

- [ ] Skill can be invoked successfully
- [ ] Routing works (if router)
- [ ] Sub-agents return within word limits (if orchestrator)
- [ ] All references load when needed
- [ ] Success criteria are achievable

## Common Issues

| Issue | Fix |
|-------|-----|
| SKILL.md over limit | Split content into references |
| Markdown headings | Convert to XML blocks |
| Missing required_reading | Add to each workflow |
| Nested references | Flatten to one level |
| No context_budget | Add to frontmatter |
| Vague success_criteria | Add checkbox format |
| Sub-agents too verbose | Add word limits |
