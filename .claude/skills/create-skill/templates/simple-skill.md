# Simple Skill Template

Use for single-file skills with one clear workflow. Max 150 lines.

---

```markdown
---
name: {skill-name}
description: {What it does}. Use when {trigger conditions}. {Third person}
context_budget:
  skill_md: 150
---

<objective>
{Clear goal statement - what this skill accomplishes}
{Keep under 10 lines}
</objective>

<quick_start>
{Minimal path to common use}
1. {First step}
2. {Second step}
3. {Third step}
</quick_start>

<process>
{Step-by-step instructions}

1. **{Step name}** [{HIGH/MEDIUM/LOW} freedom]
   {Instructions for this step}

2. **{Step name}** [{freedom level}]
   {Instructions}

3. **{Step name}** [{freedom level}]
   {Instructions}
</process>

<success_criteria>
- [ ] {Measurable outcome 1}
- [ ] {Measurable outcome 2}
- [ ] {Measurable outcome 3}
</success_criteria>
```

---

## Example: Decision Traces Skill

```markdown
---
name: decision-traces
description: Extract meaningful decisions from completed tasks. Use after task completion to capture learnings that help future agents.
context_budget:
  skill_md: 100
---

<objective>
Extract decisions made during a task that would help future agents make better choices.
</objective>

<quick_start>
1. Review the task conversation
2. Identify decision points
3. Write decisions to trace file
</quick_start>

<process>
1. **Review conversation** [MEDIUM freedom]
   Scan for moments where choices were made:
   - Technical approach selections
   - Trade-off evaluations
   - User preference discoveries

2. **Extract decisions** [HIGH freedom]
   For each decision, capture:
   - What was decided
   - Why (the rationale)
   - Context that informed it

3. **Write to trace** [LOW freedom]
   Append to the trace file at exact path specified.
   Use format: ### Decision: {title}\n**Rationale:** {why}
</process>

<success_criteria>
- [ ] 2-5 meaningful decisions extracted
- [ ] Each has clear rationale
- [ ] Written to correct trace file
</success_criteria>
```
