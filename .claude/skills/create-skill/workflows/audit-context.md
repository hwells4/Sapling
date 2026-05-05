<required_reading>
- references/core-principles.md
- references/context-budget.md
- references/validation-checklist.md
- references/common-patterns.md
- references/model-testing.md
</required_reading>

<objective>
Audit an existing skill for context efficiency, identifying improvements to reduce token usage while maintaining functionality.
</objective>

<when_to_use>
- Skill feels bloated or slow
- Want to check if skill follows best practices
- Preparing to add more content to a skill
- Reviewing skills after initial creation
</when_to_use>

<process>
1. **Read the skill**
   - Read SKILL.md
   - Count lines per section
   - Read all workflows and references
   - Map the full structure

2. **Check line counts**
   | Component | Limit | Actual |
   |-----------|-------|--------|
   | SKILL.md (simple) | 150 | ? |
   | SKILL.md (router) | 200 | ? |
   | SKILL.md (reference) | 100 | ? |
   | Individual references | 300 | ? |
   | Individual workflows | 200 | ? |

3. **Check structure patterns**
   - [ ] Uses pure XML (no markdown headings)?
   - [ ] Has context_budget in frontmatter?
   - [ ] Each workflow has `<required_reading>`?
   - [ ] References are one level deep?
   - [ ] Success criteria uses checkboxes?

4. **Conciseness review**
   For each section, evaluate:
   - Does Claude already know this?
   - Could this be shorter?
   - Should this be in a reference instead of inline?
   - Is this duplicated elsewhere?

5. **Freedom level review**
   For each process step:
   - Is the freedom level appropriate?
   - High freedom steps: are they principles-based?
   - Low freedom steps: are they exact scripts?
   - Any mismatch between fragility and specificity?

6. **Generate report**
   ```
   ## Audit: {skill-name}

   ### Line Counts
   - SKILL.md: X/Y limit (status)
   - References: list with counts
   - Workflows: list with counts

   ### Issues Found
   1. Issue description → Recommendation
   2. ...

   ### Recommendations
   - Priority 1: ...
   - Priority 2: ...

   ### Estimated Savings
   - Current estimated tokens: X
   - After fixes: Y
   - Savings: Z%
   ```

7. **Offer to fix**
   Ask user if they want to apply recommendations.
</process>

<common_issues>
| Issue | Fix |
|-------|-----|
| SKILL.md over limit | Split into references |
| Markdown headings | Convert to XML blocks |
| Missing required_reading | Add to each workflow |
| Nested references | Flatten to one level |
| Verbose explanations | Apply conciseness principle |
| No context_budget | Add to frontmatter |
| No success_criteria | Add checkbox list |
</common_issues>

<success_criteria>
- [ ] All files counted and evaluated
- [ ] Issues clearly identified
- [ ] Recommendations prioritized
- [ ] Savings estimated
- [ ] User can act on findings
</success_criteria>
