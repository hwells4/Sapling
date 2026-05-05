<required_reading>
- references/core-principles.md
- references/sub-agent-patterns.md
- references/context-budget.md
- references/degrees-of-freedom.md
- references/be-clear-and-direct.md
- references/common-patterns.md
- references/skill-structure.md
- templates/orchestrator-skill.md
- templates/sub-agent-definition.md
</required_reading>

<objective>
Create an orchestrator skill that uses sub-agents for context isolation, keeping the main context clean while gathering information from multiple sources.
</objective>

<when_to_use>
- Need to gather context from multiple sources (APIs, files, searches)
- Raw responses would bloat context (5000+ tokens each)
- Sub-agents can return condensed summaries (400-500 words)
- Need parallel processing of independent sources
- Examples: client-context, project-retrospective, linkedin-post
</when_to_use>

<key_pattern>
Sub-agent isolation:
- Each sub-agent gets a clean context window
- Returns ONLY a summary (400-500 words max)
- Orchestrator never sees raw API responses
- Result: 5x-10x context savings
</key_pattern>

<process>
1. **Identify context sources**
   Ask the user:
   - What information does this skill need to gather?
   - Where does each piece come from? (files, APIs, searches)
   - Can sources be queried in parallel, or are there dependencies?
   - What's the condensed output format for each?

2. **Design sub-agents**
   For each source, define:
   - Purpose (one sentence)
   - Tools required
   - Input parameters
   - Output format and word limit (default: 400 words)
   - Example output

3. **Design orchestration flow**
   ```
   Phase 1: Parallel spawn
   └── Independent sub-agents gather context simultaneously

   Phase 2: Coordination (optional)
   └── Agents communicate via SendMessage if they need to share/adapt

   Phase 3: Synthesis
   └── Orchestrator combines summaries into unified context

   Phase 4: Execution
   └── Final agent uses synthesized context for output

   Phase 5: Validation (optional)
   └── Validation agent checks output quality
   ```

4. **Write skill structure**
   ```
   skill-name/
   ├── SKILL.md
   ├── workflows/
   │   └── main-workflow.md    # Orchestration steps
   ├── references/
   │   ├── sub-agents.md       # REQUIRED: agent definitions
   │   └── [domain refs]
   └── templates/
       └── output-format.md
   ```

5. **Write sub-agents.md**
   Use templates/sub-agent-definition.md for each agent:
   ```
   ## {Agent Name}

   **Purpose:** One sentence

   **When to spawn:** Conditions

   **Tools required:** List

   **Prompt template:**
   ```
   You are a {role} agent...
   Return ONLY: {format}
   Maximum: {word_limit} words
   ```

   **Output handling:** How orchestrator uses this
   ```

6. **Write the workflow**
   Include:
   - Spawn commands with agent types
   - Parallel vs sequential decisions
   - Agent coordination via Task tools (if agents need to coordinate)
   - Synthesis instructions
   - Output generation

7. **Set context budget**
   ```yaml
   context_budget:
     skill_md: 150
     max_references: 4
     sub_agent_limit: 400  # Critical for orchestrators
   ```

8. **Validate**
   - [ ] Each sub-agent has word limit
   - [ ] Parallel spawning where possible
   - [ ] Synthesis step combines cleanly
   - [ ] Orchestrator never receives raw responses
</process>

<success_criteria>
- [ ] Sub-agents defined with clear purposes
- [ ] Word limits set for all sub-agents
- [ ] Parallel spawning where sources are independent
- [ ] Synthesis step produces clean unified context
- [ ] Context budget reflects sub-agent limits
- [ ] Validation step if output quality matters
</success_criteria>
