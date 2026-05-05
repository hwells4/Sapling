<required_reading>
- references/core-principles.md
- references/context-budget.md
- references/xml-structure.md
- references/degrees-of-freedom.md
- references/be-clear-and-direct.md
- references/common-patterns.md
- references/skill-structure.md
- references/workflows-and-validation.md
- templates/router-skill.md
- templates/workflow-file.md
</required_reading>

<objective>
Create a router-pattern skill with SKILL.md routing to workflows and references.
</objective>

<when_to_use>
- Multiple distinct use cases or entry points
- Shared references across workflows
- Need progressive disclosure of complex domain
- Examples: scrape-linkedin, daily-workflow, create-skill itself
</when_to_use>

<process>
1. **Gather requirements**
   Ask the user:
   - What are the different things this skill can do? (these become workflows)
   - What knowledge is shared across uses? (these become references)
   - What outputs does it produce? (these might need templates)
   - When should it trigger?

2. **Design the structure**
   ```
   skill-name/
   ├── SKILL.md              # Router (max 200 lines)
   ├── workflows/            # One per use case
   │   ├── primary-action.md
   │   └── secondary-action.md
   ├── references/           # Shared knowledge
   │   └── domain-knowledge.md
   └── templates/            # Output structures (if needed)
       └── output-format.md
   ```

3. **Write SKILL.md**
   Use templates/router-skill.md:
   - Essential principles inline (can't be skipped)
   - Intake question to determine user intent
   - Routing table mapping intent → workflow
   - References index with brief descriptions
   - Templates index (if applicable)

4. **Write each workflow**
   For each workflow file:
   - Start with `<required_reading>` block
   - Include only references needed for THIS workflow
   - Write process with appropriate freedom levels
   - End with success_criteria

5. **Write references**
   For each reference:
   - Keep under 300 lines
   - One level deep only (no nested references)
   - Focus on what Claude doesn't already know

6. **Apply conciseness check to all files**

7. **Validate structure**
   - [ ] SKILL.md under 200 lines
   - [ ] Each workflow has `<required_reading>`
   - [ ] References are one level deep
   - [ ] Pure XML throughout
</process>

<success_criteria>
- [ ] SKILL.md routes to workflows correctly
- [ ] Each workflow declares its required reading
- [ ] References are appropriately scoped
- [ ] Total structure is navigable
- [ ] Context budget declared and realistic
</success_criteria>
