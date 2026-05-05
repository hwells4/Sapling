<required_reading>
- references/core-principles.md
- references/context-budget.md
- references/be-clear-and-direct.md
- references/common-patterns.md
- references/skill-structure.md
- templates/reference-skill.md
</required_reading>

<objective>
Create a reference skill that provides domain expertise through progressive disclosure - an index that links to resources loaded only when needed.
</objective>

<when_to_use>
- Documenting domain expertise (API patterns, tool usage, conventions)
- User needs different slices of knowledge at different times
- Total knowledge base is large but each query needs small subset
- Examples: attio-mcp-usage, gmail-mcp-usage, obsidian-vault-ops
</when_to_use>

<key_pattern>
Progressive disclosure for domain knowledge:
- SKILL.md is just an index (~100 lines)
- Resources are organized by topic/pattern
- User query determines which resources load
- Zero tokens for unused knowledge
</key_pattern>

<process>
1. **Map the domain**
   Ask the user:
   - What domain is this skill documenting?
   - What are the main topic areas?
   - What are common queries/use cases?
   - What patterns or workflows exist?

2. **Organize into resources**
   Group knowledge by:
   - Topic areas (separate files)
   - Patterns (if applicable)
   - Workflows (step-by-step guides)
   - Examples (real usage samples)

3. **Design structure**
   ```
   skill-name/
   ├── SKILL.md              # Index only (~100 lines)
   └── resources/
       ├── patterns/
       │   ├── README.md     # Pattern selector
       │   ├── pattern-1.md
       │   └── pattern-2.md
       ├── workflows/
       │   └── common-task.md
       └── reference/
           └── api-details.md
   ```

4. **Write SKILL.md as index**
   - Brief description of the domain
   - When to use this skill
   - Resource index with one-line descriptions
   - How to navigate (which resource for which need)

5. **Write resources**
   For each resource file:
   - Keep under 300 lines
   - Self-contained (no dependencies on other resources)
   - Include practical examples
   - One level deep only

6. **Add pattern selector (if patterns exist)**
   Create resources/patterns/README.md:
   - List all patterns with when-to-use
   - User selects pattern → that file loads
   - Other patterns stay on disk

7. **Validate**
   - [ ] SKILL.md under 100 lines
   - [ ] Resources are self-contained
   - [ ] No nested references
   - [ ] Clear navigation from index
</process>

<example_structure>
```
attio-mcp-usage/
├── SKILL.md                    # 80 lines - just index
└── resources/
    ├── patterns/
    │   ├── README.md           # Pattern selector
    │   ├── search-records.md   # Search pattern
    │   ├── create-update.md    # CRUD pattern
    │   └── batch-operations.md # Batch pattern
    ├── golden-rules.md         # Always-apply rules
    └── tool-reference.md       # API details
```
</example_structure>

<success_criteria>
- [ ] SKILL.md is index only (under 100 lines)
- [ ] Resources organized by topic/pattern
- [ ] Each resource is self-contained
- [ ] Clear navigation from index to resources
- [ ] Progressive loading works (unused = 0 tokens)
</success_criteria>
