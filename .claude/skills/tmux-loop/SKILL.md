---
name: tmux-loop
description: Manage autonomous loop agents in tmux sessions. Spin up, monitor, attach, detach, and manage multiple concurrent loop executions. Use when running long autonomous tasks that should persist in the background.
---

<essential_principles>

**Session Lifecycle:**
Every tmux session you start MUST be tracked. When you start a session, update the state file. When it completes or you kill it, clean up.

**State File:** `.claude/loop-sessions.json`
```json
{
  "sessions": {
    "loop-feature-name": {
      "started_at": "2025-01-08T10:00:00Z",
      "project_path": "/path/to/project",
      "max_iterations": 50,
      "status": "running"
    }
  }
}
```

**Naming Convention:** `loop-{feature-name}` (lowercase, hyphens)

**Stale Session Warning:** Sessions running > 2 hours should trigger a warning. Check session age before any operation.

**Never Leave Orphans:** Before ending a conversation where you started a session, remind the user about running sessions and how to check on them.

</essential_principles>

<intake>
What would you like to do?

1. **Start** a new loop session
2. **Monitor** a running session (peek at output)
3. **Attach** to watch live
4. **List** all running sessions
5. **Kill** a session
6. **Cleanup** stale sessions

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|----------|----------|
| 1, "start", "new", "spin up", "run" | `workflows/start-session.md` |
| 2, "monitor", "check", "peek", "status" | `workflows/monitor-session.md` |
| 3, "attach", "watch", "connect" | `workflows/attach-session.md` |
| 4, "list", "show", "running" | `workflows/list-sessions.md` |
| 5, "kill", "stop", "terminate" | `workflows/kill-session.md` |
| 6, "cleanup", "stale", "orphan" | `workflows/cleanup-sessions.md` |

**After reading the workflow, follow it exactly.**
</routing>

<quick_commands>
```bash
# Start a loop
tmux new-session -d -s loop-NAME -c "$(pwd)" './scripts/loop/loop.sh 50'

# Peek at output (safe, doesn't attach)
tmux capture-pane -t loop-NAME -p | tail -50

# Attach (takes over terminal)
tmux attach -t loop-NAME
# Detach: Ctrl+b, then d

# List sessions
tmux list-sessions 2>/dev/null | grep "^loop-"

# Kill session
tmux kill-session -t loop-NAME

# Check if complete
tmux capture-pane -t loop-NAME -p | grep -q "COMPLETE" && echo "Done"
```
</quick_commands>

<reference_index>
| Reference | Purpose |
|-----------|---------|
| references/tmux-commands.md | Full tmux command reference |
| references/state-management.md | State file operations |
</reference_index>

<workflows_index>
| Workflow | Purpose |
|----------|---------|
| start-session.md | Spin up a new loop in tmux |
| monitor-session.md | Safely peek at output without attaching |
| attach-session.md | Connect to watch live + detach |
| list-sessions.md | Show all running loop sessions |
| kill-session.md | Terminate a session |
| cleanup-sessions.md | Find and handle stale sessions |
</workflows_index>

<scripts_index>
| Script | Purpose |
|--------|---------|
| scripts/check-sessions.sh | List sessions with age and status |
| scripts/warn-stale.sh | Check for sessions > 2 hours old |
</scripts_index>
