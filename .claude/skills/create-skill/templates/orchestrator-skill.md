# Orchestrator Skill Template

Use for skills that spawn sub-agents for context isolation. SKILL.md max 200 lines.

---

## Directory Structure

```
{skill-name}/
├── SKILL.md
├── workflows/
│   └── {main-workflow}.md     # Orchestration steps
├── references/
│   ├── sub-agents.md          # REQUIRED: agent definitions
│   └── {domain-refs}.md
└── templates/
    └── {output-format}.md
```

---

## SKILL.md Template

```markdown
---
name: {skill-name}
description: {What it does using sub-agents}. Use when {triggers}. {Third person}
context_budget:
  skill_md: 150
  max_references: 4
  sub_agent_limit: 400
---

<objective>
{Goal achieved through multi-agent coordination}
</objective>

<essential_principles>
{Critical coordination rules}
- Multi-agent coordination uses Task tools (TaskCreate, TeamCreate, SendMessage)
- Sub-agents return summaries only (max {limit} words)
- Parallel spawn when sources are independent
- Synthesis before final output
</essential_principles>

<quick_start>
1. User provides {input}
2. Sub-agents gather context in parallel
3. Orchestrator synthesizes results
4. Final agent produces output
5. Validation (if applicable)
</quick_start>

<routing>
| Intent | Workflow |
|--------|----------|
| {Main use case} | workflows/{main}.md |
| {Alternate use} | workflows/{alternate}.md |
</routing>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/sub-agents.md | Agent definitions with prompts |
| references/{domain}.md | {Description} |
</references_index>

<success_criteria>
- [ ] Sub-agents return within word limits
- [ ] Context is synthesized cleanly
- [ ] Output meets quality standards
</success_criteria>
```

---

## Sub-Agents Reference Template

Create `references/sub-agents.md`:

```markdown
# Sub-Agent Definitions

## {Agent 1 Name}

**Purpose:** {One sentence}

**When to spawn:** {Conditions}

**Tools required:** {List}

**Prompt template:**
```
You are a {role} agent gathering {what}.

Your task:
1. {Step 1}
2. {Step 2}
3. {Step 3}

Return ONLY:
- {Format point 1}
- {Format point 2}
- {Format point 3}

Maximum: {word_limit} words. Be concise.
```

**Output handling:** {How orchestrator uses this}

---

## {Agent 2 Name}

**Purpose:** {One sentence}

**When to spawn:** {Conditions}

**Tools required:** {List}

**Prompt template:**
```
{Prompt}
```

**Output handling:** {How used}

---

## Synthesis Agent (if needed)

**Purpose:** Combine sub-agent outputs into unified context.

**When to spawn:** After all research agents complete.

**Prompt template:**
```
You are a synthesis agent combining research from multiple sources.

You have received:
- {Agent 1} findings: {summary}
- {Agent 2} findings: {summary}
- {Agent 3} findings: {summary}

Create a unified context that:
1. Identifies common themes
2. Resolves contradictions
3. Prioritizes actionable insights

Maximum: 600 words.
```

---

## Validation Agent (if needed)

**Purpose:** Check output quality against standards.

**When to spawn:** After final output is generated.

**Prompt template:**
```
You are a validation agent checking output quality.

Review the output for:
- [ ] {Quality check 1}
- [ ] {Quality check 2}
- [ ] {Quality check 3}

Return:
- PASS/FAIL status
- List of issues found
- Suggested fixes
```
```

---

## Orchestration Workflow Template

Create `workflows/{main-workflow}.md`:

```markdown
<required_reading>
- references/sub-agents.md
- references/{domain}.md
</required_reading>

<objective>
Orchestrate sub-agents to gather context and produce {output}.
</objective>

<process>
1. **Parse user input** [MEDIUM freedom]
   Extract: {what to extract}

2. **Spawn research agents in parallel** [LOW freedom]
   Use Task tools (TaskCreate with dependencies, TeamCreate for teams).
   ```
   spawn([
     {Agent1}(topic={topic}),
     {Agent2}(topic={topic}),
     {Agent3}(topic={topic})
   ])
   ```

3. **Wait for all agents** [LOW freedom]
   Collect summaries from each agent.

4. **Synthesize context** [MEDIUM freedom]
   Combine findings into unified context:
   - Common themes
   - Key insights
   - Actionable patterns

5. **Generate output** [HIGH freedom]
   Using synthesized context, produce {output type}.
   Follow principles in references/{style}.md.

6. **Validate** [LOW freedom]
   Run validation checks:
   - [ ] {Check 1}
   - [ ] {Check 2}
   - [ ] {Check 3}

7. **Return result** [LOW freedom]
   Return output with validation notes.
</process>

<success_criteria>
- [ ] All sub-agents returned within word limits
- [ ] Context was synthesized successfully
- [ ] Output passes validation
- [ ] User receives clean result
</success_criteria>
```
