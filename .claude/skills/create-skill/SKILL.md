---
name: create-skill
description: Create Claude Code skills with context engineering built in. Use when building new skills, auditing existing skills, or adding components to skills. Supports four archetypes: simple, router, orchestrator, and reference.
context_budget:
  skill_md: 200
  max_references: 12
  sub_agent_limit: 500
---

<objective>
Create well-structured, context-efficient Claude Code skills that follow progressive disclosure patterns and declare their context budgets.
</objective>

<essential_principles>
These principles are non-negotiable for every skill created:

1. **Progressive Disclosure**
   - Layer 1: Metadata (name, description) loads at startup (~50 tokens)
   - Layer 2: SKILL.md loads when triggered (max 200 lines for router skills)
   - Layer 3: References/workflows load on-demand during execution
   - Constraint: "How do I structure so Claude loads only what's needed?"

2. **Conciseness**
   - "The context window is a public good"
   - Only add context Claude doesn't already have
   - Every paragraph must justify its token cost
   - Default assumption: Claude is already very smart

3. **Pure XML Structure**
   - Use XML blocks (`<objective>`, `<process>`) not markdown headings
   - 25% token savings vs markdown
   - Unambiguous section boundaries

4. **Required Reading Pattern**
   - Every workflow declares which references to load
   - Context is task-specific, not monolithic

5. **Skill Evolution**
   - Skills drift out of alignment over months — design for iterative change
   - Stable core (SKILL.md, workflows) + evolving periphery (`learnings.md`, knowledge files)
   - Scripts stay dumb I/O; domain knowledge lives in `.md` files Claude can update
   - See references/skill-evolution.md for patterns
</essential_principles>

<quick_start>
Most common use: Create a new skill

1. User describes what the skill should do
2. Classify archetype (simple/router/orchestrator/reference)
3. Generate SKILL.md with appropriate structure
4. If router+: generate workflows and references
5. Validate context budget

Run: "I need a skill that [description]"
</quick_start>

<intake>
What would you like to do?

1. **Create new skill** → workflows/create-simple.md or workflows/create-router.md
2. **Create orchestrator skill** (uses sub-agents) → workflows/create-orchestrator.md
3. **Create reference skill** (progressive disclosure) → workflows/create-reference.md
4. **Audit existing skill** → workflows/audit-context.md
5. **Verify skill is current** → workflows/verify-skill.md
6. **Add workflow to skill** → workflows/add-workflow.md
7. **Add reference to skill** → workflows/add-reference.md
8. **Upgrade simple to router** → workflows/upgrade-to-router.md
9. **Make skill adaptive/self-healing** → references/skill-evolution.md
10. **Add hooks to a skill** → references/skill-hooks.md
11. **Fix unreliable skill completion** → references/skill-hooks.md → invoke `/create-hooks:create-hook`

Ask the user which they need, or infer from their request.
</intake>

<routing>
| User Intent | Archetype | Workflow |
|-------------|-----------|----------|
| Simple task, single file | Simple | workflows/create-simple.md |
| Multiple workflows, needs routing | Router | workflows/create-router.md |
| Needs sub-agents for context isolation | Orchestrator | workflows/create-orchestrator.md |
| Domain knowledge, progressive loading | Reference | workflows/create-reference.md |
| Check existing skill efficiency | - | workflows/audit-context.md |
| Verify skill content is still accurate | - | workflows/verify-skill.md |
| Add capability to existing | - | workflows/add-workflow.md |
| Add reference file | - | workflows/add-reference.md |
| Convert simple to complex | - | workflows/upgrade-to-router.md |
| Make skill adaptive/self-healing | - | references/skill-evolution.md |
| Add hooks to a skill | - | references/skill-hooks.md |
| Skill completion unreliable | - | references/skill-hooks.md → `/create-hooks:create-hook` |
</routing>

<archetype_selection>
Help user select archetype:

**Simple** - Single SKILL.md (max 150 lines)
- Decision summaries, goal tracking, basic utilities
- No sub-components needed
- One clear workflow

**Router** - SKILL.md + workflows/ + references/
- Multiple distinct use cases
- Shared references across workflows
- Examples: scrape-linkedin, daily-workflow

**Orchestrator** - Router + sub-agents
- Needs to gather context from multiple sources
- Context isolation critical (sub-agents return summaries)
- Examples: client-context, project-retrospective

**Reference** - Index + progressive-load resources
- Domain expertise documentation
- User needs different slices at different times
- Examples: attio-mcp-usage, gmail-mcp-usage
</archetype_selection>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/core-principles.md | Context engineering fundamentals |
| references/context-budget.md | Token budgeting patterns |
| references/degrees-of-freedom.md | Instruction specificity classification |
| references/sub-agent-patterns.md | Orchestrator patterns from client-context |
| references/xml-structure.md | Pure XML best practices |
| references/validation-checklist.md | Pre-completion checks |
| references/model-testing.md | Haiku/Sonnet/Opus testing patterns |
| references/scripts-pattern.md | When and how to use scripts/ folder |
| references/skill-evolution.md | learnings.md, living knowledge files, self-healing patterns |
| references/skill-hooks.md | Frontmatter hooks, Stop hook gotcha, when to escalate to the create-hooks plugin |
| references/common-patterns.md | Templates, examples, anti-patterns, validation |
| references/be-clear-and-direct.md | Clarity, specificity, edge cases, decision criteria |
| references/skill-structure.md | Directory structure, file organization patterns |
| references/workflows-and-validation.md | Workflow design, validation scripts, error handling |
</references_index>

<templates_index>
| Template | Use For |
|----------|---------|
| templates/simple-skill.md | Single-file skills |
| templates/router-skill.md | Multi-workflow skills |
| templates/orchestrator-skill.md | Sub-agent skills |
| templates/reference-skill.md | Progressive disclosure skills |
| templates/workflow-file.md | Individual workflow files |
| templates/sub-agent-definition.md | Sub-agent prompt structure |
</templates_index>

<frontmatter_validation>
Every skill MUST have valid YAML frontmatter. Validate before completion:

**Required fields:**
- `name:` - Skill identifier (kebab-case)
- `description:` - What it does AND when to use (includes trigger phrases)
- `context_budget:` - Token budget declaration

**Validation rules:**
1. Frontmatter block exists (starts with `---`)
2. `description:` contains trigger phrases ("Use when...", "Invoke for...")
3. `context_budget:` declares at minimum `skill_md:` limit
4. Description is functional code - it's how semantic matching finds skills
</frontmatter_validation>

<success_criteria>
- [ ] Skill follows selected archetype structure
- [ ] SKILL.md under line limit for archetype
- [ ] Frontmatter has name, description, context_budget
- [ ] Description includes trigger phrases for semantic matching
- [ ] context_budget declared in frontmatter
- [ ] All workflows have `<required_reading>`
- [ ] Pure XML structure (no markdown headings in body)
- [ ] success_criteria uses checkbox format
</success_criteria>
