# Workflow File Template

Standard structure for individual workflow files.

---

```markdown
<required_reading>
- references/{always-needed}.md
- references/{for-this-workflow}.md
</required_reading>

<objective>
{What this specific workflow accomplishes}
{One clear goal}
</objective>

<when_to_use>
{Conditions when this workflow applies}
- {Condition 1}
- {Condition 2}
</when_to_use>

<key_pattern>
{Optional: Important insight or pattern for this workflow}
</key_pattern>

<process>
1. **{Step Name}** [{HIGH/MEDIUM/LOW} freedom]
   {Instructions for this step}
   {Be specific for LOW, principled for HIGH}

2. **{Step Name}** [{freedom level}]
   {Instructions}

3. **{Step Name}** [{freedom level}]
   {Instructions}

4. **{Step Name}** [{freedom level}]
   {Instructions}
</process>

<success_criteria>
- [ ] {Measurable outcome 1}
- [ ] {Measurable outcome 2}
- [ ] {Measurable outcome 3}
</success_criteria>
```

---

## Freedom Level Guidelines

**HIGH freedom** - Give principles:
```
1. **Write the post** [HIGH freedom]
   Create content that:
   - Opens with a hook
   - Delivers clear value
   - Matches voice in references/voice.md
```

**MEDIUM freedom** - Give patterns:
```
2. **Search for examples** [MEDIUM freedom]
   Look in these locations:
   - library/posts/ (primary)
   - outputs/linkedin/ (secondary)
   Return up to 5 relevant matches.
```

**LOW freedom** - Give exact scripts:
```
3. **Commit changes** [LOW freedom]
   Run exactly:
   ```bash
   git add -A
   git commit -m "{message}"
   ```
   Do not modify these commands.
```

---

## Line Limit

Keep workflow files under 200 lines.

If a workflow exceeds this:
- Split into sub-workflows
- Move detail to references
- Simplify the process
