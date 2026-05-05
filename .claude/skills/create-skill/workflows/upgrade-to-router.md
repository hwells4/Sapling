<required_reading>
- references/core-principles.md
- templates/router-skill.md
</required_reading>

<objective>
Convert a simple single-file skill to a router-pattern skill with workflows and references.
</objective>

<when_to_use>
- Simple skill has grown beyond 150 lines
- Multiple distinct use cases have emerged
- Knowledge should be shared across workflows
- Need more structured organization
</when_to_use>

<process>
1. **Analyze current skill**
   - Read the SKILL.md
   - Identify distinct process flows (become workflows)
   - Identify reusable knowledge (becomes references)
   - Identify output structures (become templates)

2. **Plan the split**
   ```
   Current SKILL.md sections → New location
   ─────────────────────────────────────────
   objective, quick_start    → Keep in SKILL.md
   essential_principles      → Keep in SKILL.md
   process (flow 1)          → workflows/flow-1.md
   process (flow 2)          → workflows/flow-2.md
   domain knowledge          → references/domain.md
   output format             → templates/output.md
   success_criteria          → Keep in SKILL.md (general)
                             → Also in each workflow (specific)
   ```

3. **Create directory structure**
   ```bash
   mkdir -p .claude/skills/{name}/{workflows,references,templates}
   ```

4. **Extract workflows**
   For each distinct flow:
   - Create workflow file
   - Add `<required_reading>` block
   - Move relevant process steps
   - Add flow-specific success_criteria

5. **Extract references**
   For reusable knowledge:
   - Create reference file
   - Keep under 300 lines
   - Remove from SKILL.md

6. **Rewrite SKILL.md as router**
   - Keep essential_principles inline
   - Add intake question
   - Add routing table
   - Add references_index
   - Add templates_index
   - Keep general success_criteria

7. **Update context_budget**
   ```yaml
   context_budget:
     skill_md: 200  # increased from 150
     max_references: X  # based on new structure
   ```

8. **Validate**
   - [ ] SKILL.md under 200 lines
   - [ ] All workflows have required_reading
   - [ ] No orphaned content
   - [ ] Routing covers all use cases
</process>

<success_criteria>
- [ ] Directory structure created
- [ ] Workflows extracted with required_reading
- [ ] References extracted and indexed
- [ ] SKILL.md is now a router
- [ ] Nothing lost in conversion
- [ ] Context budget updated
</success_criteria>
