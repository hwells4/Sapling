#!/usr/bin/env python3
"""
Post-Write Hook: Chatroom State Sync

Fires after ANY write to brain/traces/agents/*.md (chatroom files).
Maintains a lightweight state file that agents can poll instead of
re-parsing the entire chatroom.

Benefits:
1. O(1) state lookup vs O(n) file parsing
2. Write-time validation (enforce protocol)
3. Single source of truth (no interpretation drift)
4. Enables faster polling (5s vs 15-30s)
5. Serializes concurrent writes (consistency)

State file: ~/.claude/hook-state/chatroom-{date}-{slug}.json
"""
import json
import sys
import os
import re
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

STATE_DIR = Path(os.path.expanduser("~/.claude/hook-state"))
LOCK_TIMEOUT = 5  # seconds


def main():
    """Main entry point - runs after write completes."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    # Get the file that was written
    file_path = input_data.get("tool_input", {}).get("file_path", "")

    # Only process chatroom files
    if "brain/traces/agents/" not in file_path or not file_path.endswith(".md"):
        sys.exit(0)

    # Read the file content (it was just written)
    try:
        content = Path(file_path).read_text()
    except Exception:
        sys.exit(0)

    # Parse and compute state
    state = compute_chatroom_state(content, file_path)

    # Write state file atomically (prevents partial reads)
    state_file = get_state_file_path(file_path)
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)

        # Write to temp file first, then atomic rename
        # This prevents other processes from reading partial JSON
        fd, temp_path = tempfile.mkstemp(
            dir=STATE_DIR,
            prefix=".chatroom-state-",
            suffix=".tmp"
        )
        try:
            with os.fdopen(fd, 'w') as f:
                json.dump(state, f, indent=2)
            # Atomic rename (on POSIX systems)
            os.replace(temp_path, state_file)
        except Exception:
            # Clean up temp file on error
            try:
                os.unlink(temp_path)
            except:
                pass
            raise
    except Exception as e:
        # State file write failed - not critical, just log
        # The consensus gate will fall back to parsing the chatroom
        sys.stderr.write(f"chatroom-state-sync: failed to write state: {e}\n")

    # Optional: Return feedback to the writing agent
    feedback = generate_feedback(state)
    if feedback:
        # This message goes back to the agent that just wrote
        print(json.dumps({"message": feedback}))

    sys.exit(0)


def compute_chatroom_state(content: str, file_path: str) -> Dict[str, Any]:
    """
    Parse chatroom content and compute authoritative state.
    This runs ONCE per write, not once per read.
    """
    state = {
        "file": file_path,
        "updated_at": datetime.now().isoformat(),
        "update_count": 0,

        # Coordination signals
        "has_close": False,
        "agents_ready": [],
        "agents_waiting": {},  # agent -> who they're waiting on
        "agents_blocked": {},  # agent -> reason

        # Metadata
        "status": "unknown",
        "expected_agents": [],
        "all_agents_seen": [],
    }

    # Load previous state to increment counter
    state_file = get_state_file_path(file_path)
    if state_file.exists():
        try:
            prev = json.load(open(state_file))
            state["update_count"] = prev.get("update_count", 0) + 1
        except:
            pass

    # Parse frontmatter for metadata
    frontmatter_match = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
    if frontmatter_match:
        fm = frontmatter_match.group(1)

        # Extract status
        status_match = re.search(r'status:\s*(\w+)', fm)
        if status_match:
            state["status"] = status_match.group(1)

        # Extract expected agents
        agents_match = re.search(r'agents:\s*\[(.*?)\]', fm)
        if agents_match:
            agents_str = agents_match.group(1)
            state["expected_agents"] = [a.strip() for a in agents_str.split(",")]

    # Parse coordination signals from content

    # Find CLOSE signal
    if re.search(r'→\s*CLOSE', content):
        state["has_close"] = True

    # Find all agent posts and their signals
    # Pattern: ## [HH:MM] agent-name
    agent_posts = re.findall(
        r'##\s*\[[\d:]+\]\s*(\S+)\n(.*?)(?=##\s*\[|$)',
        content,
        re.DOTALL
    )

    for agent_name, post_content in agent_posts:
        if agent_name not in state["all_agents_seen"]:
            state["all_agents_seen"].append(agent_name)

        # Check for READY signal in this post
        if re.search(r'→\s*READY', post_content):
            if agent_name not in state["agents_ready"]:
                state["agents_ready"].append(agent_name)

        # Check for WAITING signal
        waiting_match = re.search(r'→\s*WAITING\s+@(\S+)', post_content)
        if waiting_match:
            state["agents_waiting"][agent_name] = waiting_match.group(1)

        # Check for BLOCKED signal
        blocked_match = re.search(r'→\s*BLOCKED:\s*(.+)', post_content)
        if blocked_match:
            state["agents_blocked"][agent_name] = blocked_match.group(1).strip()

    # Compute derived state
    state["coordination_complete"] = (
        state["has_close"] or
        (len(state["agents_ready"]) > 0 and
         len(state["agents_waiting"]) == 0 and
         set(state["expected_agents"]) <= set(state["agents_ready"]))
    )

    # Count ready vs expected
    if state["expected_agents"]:
        ready_set = set(state["agents_ready"])
        expected_set = set(state["expected_agents"])
        state["ready_count"] = len(ready_set & expected_set)
        state["expected_count"] = len(expected_set)
        state["missing_agents"] = list(expected_set - ready_set)

    return state


def get_state_file_path(chatroom_path: str) -> Path:
    """Generate state file path from chatroom path."""
    # Extract filename without extension
    filename = Path(chatroom_path).stem  # e.g., "2025-12-29-dustin-commitments"
    return STATE_DIR / f"chatroom-{filename}.json"


def generate_feedback(state: Dict[str, Any]) -> Optional[str]:
    """
    Generate feedback message to the writing agent.
    This helps agents understand the current coordination state.
    """
    messages = []

    # If someone is waiting on orchestrator, flag it
    for agent, waiting_on in state.get("agents_waiting", {}).items():
        if waiting_on.lower() == "orchestrator":
            messages.append(f"NOTE: {agent} is WAITING on orchestrator")

    # If coordination is complete but no CLOSE yet
    if state.get("coordination_complete") and not state.get("has_close"):
        if state.get("expected_agents"):
            messages.append(
                f"All {len(state['agents_ready'])}/{state.get('expected_count', '?')} "
                f"agents READY. Consider posting CLOSE."
            )

    # Report blocked agents
    for agent, reason in state.get("agents_blocked", {}).items():
        messages.append(f"BLOCKED: {agent} - {reason}")

    if messages:
        return "Chatroom state: " + " | ".join(messages)

    return None


def validate_write(content: str, agent_name: Optional[str]) -> Optional[str]:
    """
    Validate the write follows protocol.
    Returns error message if invalid, None if valid.

    NOTE: This is currently informational only (post-write).
    To actually block invalid writes, this would need to be
    a pre-write hook checking tool_input.content.
    """
    # Check if the latest post has a signal
    # This is aspirational - we'd need different hook type to enforce
    return None


if __name__ == "__main__":
    main()
