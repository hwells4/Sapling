# Sapling OS

A personal knowledge system built on Obsidian + Claude Code that learns user preferences over time.

You manage this system: a structured vault (`brain/`), reusable workflows (`skills/`), and a learning loop that improves from decisions. Your job is to execute tasks with minimal context pollution while capturing decisions that make the system smarter.

**Core loop:** User requests → You execute → Decisions traced → Skills improve → Better execution next time.

<querying>
**By Path (fastest):**
- `brain/entities/` → People and companies
- `brain/calls/` → Call notes
- `brain/outputs/` → Deliverables (posts, PRDs, emails)
- `brain/traces/` → Decision traces
- `brain/inbox/` → Tasks pending action
- `brain/context/` → Identity, business, voice

**By Tag (most flexible):**
Tags follow `/schemas/tags/taxonomy.yaml`. Key namespaces:
- `client/{slug}` - All content for a client
- `person/{slug}` - All content involving a person
- `company/{slug}` - All content involving a company
- `topic/{topic}` - Subject matter (check registry first)
- `status/{status}` - State (draft, published, done, etc.)
- `output/{type}` - Output type (linkedin-post, prd, email)

**Example: "Find everything about John"**
```bash
grep -r "person/john-doe" brain/
grep -r "\[\[entities/john-doe\]\]" brain/
```

**By Frontmatter (structured):**
- `people:` - Wiki-links to person entities
- `companies:` - Wiki-links to company entities
- `schema_version:` - File format version
- `type:` / `status:` - Entity classification

**Before querying topics:** Read `/schemas/tags/registry.yaml` for existing topics. Use existing tags before creating new ones.

**Source of Truth:**
- **Beads** owns: All tasks (human and agent), dependencies, work status
- **Obsidian (brain/)** owns: Knowledge—entities, calls, outputs, traces, context
</querying>

<tools>
**Beads (`bd`):** File-based issue tracking in `.beads/`. Use for multi-session work, dependencies, discovered tasks. Commands: `bd ready`, `bd create`, `bd close`, `bd sync`. See `agents.md` for full reference.

**Skills:** Reusable workflows in `.claude/skills/`. Each skill has a `SKILL.md` defining its purpose, triggers, and workflow. Invoked via slash commands (`/task`, `/onboard`, `/calibrate`).

**Commands:** Slash commands in `.claude/commands/`. Lightweight wrappers that may invoke skills or run standalone workflows.

**Hooks:** Event handlers in `.claude/hooks/`. Run on file edits (schema validation), session start, etc.
</tools>

<context_engineering>
The context window is a public good. Every token competes for attention.

**Progressive Disclosure:**
- Load metadata first (~50 tokens)
- Load skill content only when triggered (~1,500 tokens)
- Load references only when workflows require them (0 tokens until needed)

**Sub-Agent Trigger Rule:**
Spawn sub-agents when reading OR editing 3+ files, regardless of task complexity.
Subagents are for context management, not complexity. The orchestrator should know *what* was done, not *how* every file looks. Orchestrator receives only summaries, not raw outputs.

**Sub-Agent Output Limits:**
Max 2,000 words per sub-agent. Return structured proposals or summaries, not prose analysis. Analysis stays in sub-agent context; only actionable output returns to orchestrator.

**Context Resumption:**
After context compaction or session resume, verify actual file state (`git status`, read files) before trusting completion claims from summaries. Summaries may report "done" when work is staged but uncommitted.

**Chatroom Coordination:**
When spawning 2+ parallel sub-agents, invoke `agent-chatroom` skill first.
</context_engineering>

<evolution>
This system learns from decisions. When `/task` completes:
1. `decision-traces` skill captures meaningful choices
2. Traces marked with `target_skill` identify improvement opportunities
3. `/review-traces` (upcoming) proposes skill upgrades

**Litmus Test:** Only capture choices between alternatives that change future behavior with non-obvious reasoning.
</evolution>

<task_management>
**Beads (`bd`)** is the single task system. All work—human and agent—lives here.

| Assignee | Use For | Example |
|----------|---------|---------|
| `human` | Tasks requiring user action | "Review PR", "Approve design" |
| `agent` | Tasks Claude executes | "Implement feature", "Fix bug" |

**Core workflow:**
```bash
bd ready                    # What can I work on?
bd update <id> --status=in_progress
# ... do the work ...
bd close <id>
bd sync                     # Push to git
```

**TodoWrite** is optional—use it to show the user progress during long sessions. It's ephemeral (memory only).

**Rules:**
- Create beads for multi-step work, discovered tasks, anything that might span sessions
- Use `--assignee=agent` for agent work, `--assignee=human` for human work
- Dependencies: `bd dep add <blocker> <blocked-by>` when tasks must sequence
</task_management>

<commands>
| Command | Purpose |
|---------|---------|
| `/task` | Start task with decision tracing |
| `/today` | Daily note workflow |
| `/weekly` | Weekly review process |
| `/commit` | Git commit with Linear sync |
| `/migrate` | Run schema migrations |
| `/review-traces` | Upgrade skills from decision traces |
| `/create-skill` | Create new skills |
</commands>

<behaviors>
- **Start simple:** Default to simpler approach. Build sharp knife first. Add complexity only when constraints prove insufficient in practice.
- **Wait for failure:** Before adding infrastructure (new hooks, state directories, multi-file solutions), require the simpler fix to fail first through actual use.
- **Before acting:** Query the system for relevant context (entities, calls, prior outputs).
- **Use skills:** Invoke available skills rather than reinventing workflows.
- **Parallel over sequential:** Run independent tool calls in parallel.
- **Use beads for persistence:** Multi-step work, API-heavy tasks, anything that might span sessions—create beads so progress isn't lost.
</behaviors>
