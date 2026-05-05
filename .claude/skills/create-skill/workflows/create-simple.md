<required_reading>
- references/core-principles.md
- references/context-budget.md
- references/degrees-of-freedom.md
- references/be-clear-and-direct.md
- references/common-patterns.md
- templates/simple-skill.md
</required_reading>

<objective>
Create a simple, single-file skill (max 150 lines) for straightforward tasks.
</objective>

<when_to_use>
- Task has one clear workflow
- No need for sub-agents or context isolation
- No shared references across use cases
- Examples: decision-traces, goal-tracking, basic utilities
</when_to_use>

<process>
1. **Gather requirements**
   Ask the user:
   - What does this skill do?
   - When should it trigger? (keywords, conditions)
   - What tools does it need?
   - What does success look like?

2. **Draft the skill**
   Use templates/simple-skill.md as base:
   - Write name (lowercase-with-hyphens, matches directory)
   - Write description (third person: "what it does AND when to use it")
   - Set context_budget.skill_md to 150 max
   - Write objective (clear goal, under 10 lines)
   - Write quick_start (minimal path, under 20 lines)
   - Write process (step-by-step, appropriate freedom level)
   - Write success_criteria (checkbox format)

3. **Apply conciseness check**
   For each section, ask:
   - [ ] Does Claude need this, or does it already know?
   - [ ] Is this the minimum needed to accomplish the goal?
   - [ ] Could any of this be implied instead of stated?

4. **Classify freedom levels**
   For each step in process:
   - High freedom (principles only): creative tasks
   - Medium freedom (patterns): standard work
   - Low freedom (exact scripts): fragile operations

5. **Write the file**
   Create `.claude/skills/{name}/SKILL.md`

6. **Validate**
   - [ ] Under 150 lines
   - [ ] Pure XML structure
   - [ ] context_budget declared
   - [ ] success_criteria has checkboxes
</process>

<success_criteria>
- [ ] Single SKILL.md file created
- [ ] Under 150 lines total
- [ ] Follows simple-skill template structure
- [ ] Passes conciseness check
- [ ] Freedom levels appropriate for each step
</success_criteria>
