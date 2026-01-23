#!/bin/bash
# Install task-orchestration skill for Claude Code
# Usage: curl -sSL https://raw.githubusercontent.com/hwells4/PersonalOS/main/brain/outputs/skills/install-task-orchestration.sh | bash

set -e

SKILL_DIR="$HOME/.claude/skills/task-orchestration"
CMD_DIR="$HOME/.claude/commands"

echo "Installing task-orchestration skill..."

# Create directories
mkdir -p "$SKILL_DIR"
mkdir -p "$CMD_DIR"

# Write SKILL.md
cat > "$SKILL_DIR/SKILL.md" << 'SKILL_EOF'
---
name: task-orchestration
description: Use Claude Code's built-in Task tools for dependency-aware orchestration within sessions. Invoke when decomposing complex work, spawning parallel agents, or tracking multi-step tasks.
---

<objective>
Orchestrate complex work using Claude Code's built-in TaskCreate, TaskUpdate, TaskGet, and TaskList tools. Creates dependency graphs, assigns work to agents, and tracks progress visually (ctrl+t).
</objective>

<quick_start>
**Decompose work into tasks with dependencies:**

```
TaskCreate: "Set up database connection"
TaskCreate: "Create user model" → addBlockedBy: ["1"]
TaskCreate: "Build auth routes" → addBlockedBy: ["1", "2"]
```

**Spawn parallel agents for independent work:**
```
Task(subagent_type: "general-purpose", owner: "backend-dev", ...)
Task(subagent_type: "general-purpose", owner: "frontend-dev", ...)
```

**Track progress:** Press `ctrl+t` to toggle visual task view.
</quick_start>

<when_to_use>
**Use Task tools when:**
- Multi-step work (3+ steps)
- Steps have dependencies (can't do Y until X is done)
- Spawning parallel agents
- Want visual progress tracking
- Complex single-session work

**Skip task tools when:**
- Quick one-off questions
- Simple single-file edits
- Anything finished in one shot
</when_to_use>

<tools>
**TaskCreate** - Create a new task
```json
{
  "subject": "Set up database connection",
  "description": "Configure PostgreSQL pool, create users table",
  "activeForm": "Setting up database"
}
```
- Tasks start with status `pending`, no owner
- `activeForm` shows in progress spinner

**TaskUpdate** - Modify task state
```json
{
  "taskId": "3",
  "status": "in_progress",
  "owner": "backend-dev",
  "addBlockedBy": ["1", "2"]
}
```
- `addBlockedBy`/`addBlocks` append (don't replace)
- Blocked tasks auto-unblock when dependencies complete
- Status: `pending` → `in_progress` → `completed`

**TaskGet** - Retrieve full task details
```json
{ "taskId": "3" }
```
Returns: subject, description, status, blocks, blockedBy

**TaskList** - See all tasks
```json
{}
```
Returns: ID, subject, status, owner, blocked-by relationships
</tools>

<dependency_patterns>
**Linear chain:**
```
#1 Research → #2 Plan → #3 Implement → #4 Test
Each task addBlockedBy previous
```

**Parallel then converge:**
```
#1 Research API (no deps)
#2 Research DB (no deps)
#3 Design solution → addBlockedBy: ["1", "2"]
#4 Implement → addBlockedBy: ["3"]
```

**Fan out:**
```
#1 Core implementation
#2 Update routes → addBlockedBy: ["1"]
#3 Update models → addBlockedBy: ["1"]
#4 Update tests → addBlockedBy: ["1"]
(#2, #3, #4 can run in parallel after #1)
```
</dependency_patterns>

<agent_orchestration>
**Assigning work to agents:**

1. Create tasks with meaningful subjects
2. Assign owners via TaskUpdate
3. Spawn agents that find their work

```
// Assign
TaskUpdate: { "taskId": "4", "owner": "fact-checker" }
TaskUpdate: { "taskId": "5", "owner": "editor" }

// Spawn (in single message for parallel execution)
Task(subagent_type: "general-purpose", model: "haiku",
     prompt: "You are fact-checker. Call TaskList, find tasks
              with owner 'fact-checker', complete them.
              Mark in_progress when starting, completed when done.")

Task(subagent_type: "general-purpose", model: "haiku",
     prompt: "You are editor. Call TaskList, find tasks
              with owner 'editor', complete them...")
```

**Model selection:**
- `haiku` - Running commands, simple searches, straightforward tasks
- `sonnet` - Moderate complexity, most implementation work
- `opus` - Architecture decisions, nuanced problems, multi-step reasoning

**Agent types:**
- `general-purpose` - Can read/write/edit/search/run commands
- `Bash` - Terminal only, fast and focused
- `Explore` - Read-only, codebase navigation
- `Plan` - Read-only, architecture design
</agent_orchestration>

<persistence>
**Within session:** Tasks survive context compaction automatically.

**Across sessions:** Set environment variable:
```bash
# Per terminal session
CLAUDE_CODE_TASK_LIST_ID="my-project" claude

# Or in .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_TASK_LIST_ID": "my-project"
  }
}
```

Tasks stored at: `~/.claude/tasks/<list-id>/`

**Note:** Clean up completed tasks periodically - full list loads each session.
</persistence>

<workflow>
## Starting complex work

1. **Assess complexity** - Is this 3+ steps with dependencies?
2. **Create task graph** - TaskCreate for each step, set blockedBy
3. **Review with user** - Show plan, get approval
4. **Execute in order** - Mark in_progress, do work, mark completed
5. **Spawn agents** - If independent work, run parallel agents

## During execution

- Check `TaskList` when stuck
- Press `ctrl+t` for visual progress
- Blocked tasks auto-unblock when deps complete
- Add new tasks if discovered: `TaskCreate` with appropriate blockedBy

## Completing work

- Mark all tasks `completed`
- Clean up if using persistent list ID
</workflow>

<success_criteria>
Task orchestration successful when:
- Dependencies prevent out-of-order execution
- Parallel agents work without conflicts
- Progress visible via ctrl+t
- All tasks reach completed status
</success_criteria>
SKILL_EOF

# Write slash command
cat > "$CMD_DIR/orchestrate.md" << 'CMD_EOF'
---
description: Orchestrate complex work with dependency-aware tasks
argument-hint: [describe work to decompose]
allowed-tools: Skill(task-orchestration)
---

Invoke the task-orchestration skill for: $ARGUMENTS
CMD_EOF

echo "✓ Installed skill: ~/.claude/skills/task-orchestration/"
echo "✓ Installed command: /orchestrate"
echo ""
echo "Usage: /orchestrate <describe your complex task>"
echo "Or invoke directly: Skill(skill: 'task-orchestration')"
