#!/usr/bin/env python3
"""
Stop hook: Orchestrator Background Task Gate

Prevents the orchestrator (main agent) from stopping while background
tasks are still running. This complements the SubagentStop hook which
handles subagent coordination.

Checks:
1. Are there active background tasks? (from state file)
2. Is there an active chatroom without CLOSE signal?
3. Have all tracked tasks completed?

State file: ~/.claude/hook-state/orchestrator-{session_id}.json
Tracks task_ids spawned by this session.
"""
import json
import sys
import os
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

STATE_DIR = Path(os.path.expanduser("~/.claude/hook-state"))
MAX_ATTEMPTS = 3  # Fewer attempts for orchestrator - it should know better


def main():
    """Main entry point for the hook."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    session_id = input_data.get("session_id", "unknown")

    # Escape condition: Already in continuation cycle
    if input_data.get("stop_hook_active"):
        sys.exit(0)

    # Load orchestrator state
    state = load_state(session_id)

    # No tracked tasks = not an orchestrator session, allow stop
    if not state.get("task_ids"):
        sys.exit(0)

    attempt = state.get("stop_attempt", 0)

    # Escape condition: Max attempts reached
    if attempt >= MAX_ATTEMPTS:
        cleanup_state(session_id)
        sys.exit(0)

    # Check for active chatroom
    chatroom = find_active_chatroom()

    if chatroom:
        content = chatroom.read_text()

        # Check if CLOSE signal posted
        if re.search(r'→\s*CLOSE', content):
            cleanup_state(session_id)
            sys.exit(0)

        # Check for incomplete coordination
        incomplete = check_incomplete_coordination(content, state)

        if incomplete:
            attempt += 1
            state["stop_attempt"] = attempt
            save_state(session_id, state)

            output = {
                "decision": "block",
                "reason": construct_block_message(incomplete, attempt, chatroom)
            }
            print(json.dumps(output))
            sys.exit(0)

    # No active chatroom or coordination complete
    cleanup_state(session_id)
    sys.exit(0)


def find_active_chatroom() -> Optional[Path]:
    """Find the most recent active chatroom file."""
    cwd = Path.cwd()
    agents_dir = cwd / "brain" / "traces" / "agents"

    if not agents_dir.exists():
        script_dir = Path(__file__).parent.parent.parent
        agents_dir = script_dir / "brain" / "traces" / "agents"

    if not agents_dir.exists():
        return None

    today = datetime.now().strftime("%Y-%m-%d")

    for pattern in [f"{today}*.md", "*.md"]:
        for f in sorted(agents_dir.glob(pattern), reverse=True):
            try:
                content = f.read_text()
                if "status: active" in content:
                    return f
            except:
                continue

    return None


def check_incomplete_coordination(content: str, state: Dict[str, Any]) -> Optional[Dict]:
    """Check if coordination is incomplete."""

    issues = []

    # Check for agents still WAITING
    waiting = re.findall(r'→\s*WAITING\s+@(\w+)', content)
    if waiting:
        issues.append(f"Agents still waiting: {', '.join(set(waiting))}")

    # Check for unresolved BLOCKED
    blocked = re.findall(r'→\s*BLOCKED:\s*(.+)', content)
    if blocked:
        issues.append(f"Unresolved blockers: {len(blocked)}")

    # Check if all expected agents posted READY
    expected_agents = state.get("expected_agents", [])
    if expected_agents:
        ready_agents = set(re.findall(r'\[.*?\]\s*(\w+).*?→\s*READY', content, re.DOTALL))
        missing = set(expected_agents) - ready_agents
        if missing:
            issues.append(f"Agents not READY: {', '.join(missing)}")

    # Check for WAITING @orchestrator that wasn't addressed
    orchestrator_waiting = re.findall(r'→\s*WAITING\s+@orchestrator', content, re.IGNORECASE)
    orchestrator_responses = re.findall(r'\[.*?\]\s*orchestrator\n', content)
    if len(orchestrator_waiting) > len(orchestrator_responses):
        issues.append("Unaddressed requests to orchestrator")

    if issues:
        return {"issues": issues}

    return None


def construct_block_message(incomplete: Dict, attempt: int, chatroom: Path) -> str:
    """Construct block message for orchestrator."""

    lines = [
        f"Coordination incomplete (attempt {attempt}/{MAX_ATTEMPTS})",
        "",
        "Issues:"
    ]

    for issue in incomplete.get("issues", []):
        lines.append(f"  - {issue}")

    lines.extend([
        "",
        "Before stopping, you should:",
        "  1. Check background tasks with TaskOutput(task_id, block=false)",
        "  2. Read chatroom for any WAITING @orchestrator signals",
        "  3. Handle any crashed agents (post BLOCKED on their behalf)",
        "  4. Post → CLOSE when coordination is complete",
        "",
        f"Chatroom: {chatroom}"
    ])

    return "\n".join(lines)


def load_state(session_id: str) -> Dict[str, Any]:
    """Load orchestrator state for this session."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"orchestrator-{session_id}.json"

    try:
        with open(state_file) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(session_id: str, state: Dict[str, Any]):
    """Save orchestrator state."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"orchestrator-{session_id}.json"

    with open(state_file, "w") as f:
        json.dump(state, f)


def cleanup_state(session_id: str):
    """Clean up state file."""
    state_file = STATE_DIR / f"orchestrator-{session_id}.json"
    try:
        state_file.unlink()
    except FileNotFoundError:
        pass


# === Functions for orchestrators to call ===
# These would be called via a separate script or imported

def register_task(session_id: str, task_id: str, agent_name: str = None):
    """Register a background task with the orchestrator state."""
    state = load_state(session_id)

    if "task_ids" not in state:
        state["task_ids"] = []
    if "expected_agents" not in state:
        state["expected_agents"] = []

    state["task_ids"].append(task_id)
    if agent_name:
        state["expected_agents"].append(agent_name)

    save_state(session_id, state)


def mark_task_complete(session_id: str, task_id: str):
    """Mark a task as complete in orchestrator state."""
    state = load_state(session_id)

    if "completed_tasks" not in state:
        state["completed_tasks"] = []

    state["completed_tasks"].append(task_id)
    save_state(session_id, state)


if __name__ == "__main__":
    main()
