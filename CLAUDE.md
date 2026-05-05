# Sapling OS

A personal knowledge system built on Obsidian + Claude Code.

You manage this system: a structured vault (`brain/`), reusable workflows (`.claude/skills/`), hooks, and beads-backed task tracking. Your job is to execute tasks with minimal context pollution and save durable generated work in the right place.

**Core loop:** User requests → You execute → Durable outputs go to `brain/outputs/` → Tasks persist in beads → Hooks keep the workspace consistent.

<querying>
**By Path (fastest):**
- `brain/entities/` → People and companies
- `brain/calls/` → Call notes
- `brain/outputs/` → Deliverables (posts, PRDs, emails)
- `brain/traces/` → Legacy learning traces
- `brain/inbox/` → Legacy inbox items; prefer beads for active tasks
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
**Beads (`bd`):** File-based issue tracking in `.beads/`. Use for multi-session work, dependencies, discovered tasks. Commands: `bd ready`, `bd create`, `bd close`, `bd sync`. See `AGENTS.md` for full reference.

**Skills:** Reusable workflows in `.claude/skills/`. Each skill has a `SKILL.md` defining its purpose, triggers, and workflow. Invoked via slash commands such as `/task` and `/onboard`.

**Commands:** Slash commands in `.claude/commands/`. Lightweight wrappers that may invoke skills or run standalone workflows.

**Hooks:** Event handlers in `.claude/hooks/`. Hooks are core Sapling behavior. Run `.claude/hooks/setup-local-hooks.py` during onboarding to tune the local profile for this machine.
</tools>

<outputs>
Agents must not scatter generated work across arbitrary folders.

**Default behavior:**
- If the user asks for a durable artifact (draft, PRD, proposal, research summary, post, email, plan, report, script for later use), create an output in `brain/outputs/`.
- If the user asks a question, wants brainstorming, or has not asked to save anything, answer in chat only.
- If editing source code, schemas, skills, commands, hooks, or docs, edit the relevant project files directly.
- If unsure whether something should be saved, keep it in chat and ask before creating a file.

**Output path:** `brain/outputs/{YYYY-MM-DD}-{slug}.md`

**Required frontmatter:**
```yaml
---
schema_version: 1.1.0
date: YYYY-MM-DD
type: research
status: draft
tags:
  - date/YYYY-MM-DD
  - output
  - output/research
  - status/draft
---
```
</outputs>

<context_engineering>
The context window is a public good. Every token competes for attention.

**Progressive Disclosure:**
- Load metadata first (~50 tokens)
- Load skill content only when triggered (~1,500 tokens)
- Load references only when workflows require them (0 tokens until needed)

**Sub-Agent Rule:**
Only use sub-agents when the user explicitly asks for parallel agent work. Prefer beads for durable task tracking and concise local reads for ordinary cleanup.

**Context Resumption:**
After context compaction or session resume, verify actual file state (`git status`, read files) before trusting completion claims from summaries. Summaries may report "done" when work is staged but uncommitted.

</context_engineering>

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
| `/task` | Start tracked work |
| `/today` | Create or open today's daily note |
| `/weekly` | Weekly review process |
| `/create-skill` | Create or modify Claude Code skills |
| `/create-hook` | Create, edit, analyze, or debug hooks |
| `/ideate` | Generate and winnow improvement ideas |
| `/refine` | Iteratively refine plans or beads |
| `/commit` | Create an atomic git commit |
| `/migrate` | Run schema migrations |
</commands>

<behaviors>
- **Start simple:** Default to simpler approach. Build sharp knife first. Add complexity only when constraints prove insufficient in practice.
- **Wait for failure:** Before adding infrastructure (new hooks, state directories, multi-file solutions), require the simpler fix to fail first through actual use.
- **Before acting:** Query the system for relevant context (entities, calls, prior outputs).
- **Use skills:** Invoke available skills rather than reinventing workflows.
- **Parallel over sequential:** Run independent tool calls in parallel.
- **Use beads for persistence:** Multi-step work, API-heavy tasks, anything that might span sessions—create beads so progress isn't lost.
</behaviors>
