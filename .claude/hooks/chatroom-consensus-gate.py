#!/usr/bin/env python3
"""
SubagentStop hook: Chatroom Consensus Gate

Prevents subagents from stopping prematurely when participating in
multi-agent coordination via chatroom.

Signals:
  → READY              Agent completed work, no blockers
  → WAITING @agent     Agent blocked on specific agent
  → BLOCKED: reason    Agent hit external blocker
  → CLOSE              Orchestrator signals coordination complete

Escape conditions (allow stop):
  1. stop_hook_active is True (already continuing)
  2. No active chatroom exists
  3. Max retry attempts reached (exponential backoff)
  4. CLOSE signal present in chatroom
  5. This agent posted READY and no one is WAITING on them
"""
import json
import sys
import os
import re
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

# Configuration
MAX_ATTEMPTS = 5
BACKOFF_SCHEDULE = [15, 30, 60, 120, 120]  # seconds to wait per attempt
STATE_DIR = Path(os.path.expanduser("~/.claude/hook-state"))


def main():
    """Main entry point for the hook."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Can't parse input, allow stop
        sys.exit(0)

    session_id = input_data.get("session_id", "unknown")

    # Escape condition 1: Already in continuation cycle
    if input_data.get("stop_hook_active"):
        cleanup_state(session_id)
        sys.exit(0)

    # Find active chatroom
    chatroom_path = find_active_chatroom()

    # Escape condition 2: No active chatroom
    if not chatroom_path:
        sys.exit(0)

    # Load state and check retry limits
    state = load_state(session_id)
    attempt = state.get("attempt", 0)

    # Escape condition 3: Max attempts reached
    if attempt >= MAX_ATTEMPTS:
        cleanup_state(session_id)
        output = {
            "decision": "approve",
            "reason": f"Max retry attempts ({MAX_ATTEMPTS}) reached. Allowing stop to prevent infinite loop."
        }
        print(json.dumps(output))
        sys.exit(0)

    # Extract agent name from transcript if possible
    agent_name = extract_agent_name(input_data)

    # Try to use pre-computed state first (O(1) vs O(n) parsing)
    cached_state = load_chatroom_state(chatroom_path)
    if cached_state:
        evaluation = evaluate_from_state(cached_state, agent_name)
    else:
        # Fall back to parsing chatroom content
        try:
            chatroom_content = chatroom_path.read_text()
        except Exception as e:
            # Can't read chatroom, allow stop
            sys.exit(0)
        evaluation = evaluate_chatroom(chatroom_content, agent_name)

    if evaluation["should_stop"]:
        # Log approval to chatroom for visibility
        log_to_chatroom(chatroom_path, agent_name, "approved", evaluation, 0, [])
        cleanup_state(session_id)
        sys.exit(0)

    # Block the stop - increment attempt counter
    attempt += 1
    state["attempt"] = attempt
    state["last_block_time"] = time.time()
    save_state(session_id, state)

    # Calculate wait time (exponential backoff)
    wait_seconds = BACKOFF_SCHEDULE[min(attempt - 1, len(BACKOFF_SCHEDULE) - 1)]

    # Extract mentions for both logging and the block message
    mentions = extract_mentions_for_agent(chatroom_path, agent_name) if agent_name else []

    # Log block to chatroom for visibility
    log_to_chatroom(chatroom_path, agent_name, "blocked", evaluation, attempt, mentions)

    # Construct helpful block message with injected context
    block_reason = construct_block_message(evaluation, attempt, wait_seconds, chatroom_path, agent_name, mentions)

    output = {
        "decision": "block",
        "reason": block_reason
    }
    print(json.dumps(output))
    sys.exit(0)


def log_to_chatroom(
    chatroom_path: Path,
    agent_name: Optional[str],
    decision: str,
    evaluation: Dict[str, Any],
    attempt: int,
    mentions: List[str]
) -> None:
    """
    Append a hook activity log entry to the chatroom.
    Makes stop attempts visible for debugging.
    """
    if not chatroom_path or not chatroom_path.exists():
        return

    now = datetime.now().strftime("%H:%M")
    agent_label = agent_name or "unknown-agent"

    if decision == "approved":
        reason = evaluation.get("reason", "allowed")
        entry = f"\n## [{now}] 🔓 HOOK: {agent_label}\nStop approved: {reason}\n"
    else:
        # Blocked
        mention_count = len(mentions)
        mention_sources = []
        for m in mentions:
            # Extract author from "## [HH:MM] author-name"
            match = re.search(r'##\s*\[[\d:]+\]\s*(\S+)', m)
            if match:
                mention_sources.append(f"@{match.group(1)}")

        sources_str = ", ".join(mention_sources) if mention_sources else "none"
        entry = (
            f"\n## [{now}] 🔒 HOOK: {agent_label}\n"
            f"Stop blocked (attempt {attempt}/{MAX_ATTEMPTS})\n"
            f"Reason: {evaluation.get('reason', 'coordination incomplete')}\n"
            f"Injected {mention_count} mention(s) from: {sources_str}\n"
        )

    try:
        with open(chatroom_path, "a") as f:
            f.write(entry)
    except Exception:
        # Don't fail the hook if logging fails
        pass


def find_active_chatroom() -> Optional[Path]:
    """Find the most recent active chatroom file."""
    # Try current working directory first
    cwd = Path.cwd()
    agents_dir = cwd / "brain" / "traces" / "agents"

    if not agents_dir.exists():
        # Try finding from script location
        script_dir = Path(__file__).parent.parent.parent
        agents_dir = script_dir / "brain" / "traces" / "agents"

    if not agents_dir.exists():
        return None

    today = datetime.now().strftime("%Y-%m-%d")

    # Look for today's chatrooms first, then recent ones
    candidates = []
    for pattern in [f"{today}*.md", "*.md"]:
        for f in agents_dir.glob(pattern):
            try:
                content = f.read_text()
                if "status: active" in content:
                    mtime = f.stat().st_mtime
                    candidates.append((mtime, f))
            except:
                continue

    if candidates:
        candidates.sort(reverse=True)
        return candidates[0][1]

    return None


def find_state_file(chatroom_path: Path) -> Optional[Path]:
    """Find the pre-computed state file for a chatroom."""
    filename = chatroom_path.stem  # e.g., "2025-12-29-dustin-commitments"
    state_file = STATE_DIR / f"chatroom-{filename}.json"
    if state_file.exists():
        return state_file
    return None


def load_chatroom_state(chatroom_path: Path) -> Optional[Dict[str, Any]]:
    """
    Load pre-computed state from the state file.
    This is O(1) vs O(n) parsing of the chatroom.
    Falls back to parsing if state file doesn't exist or is invalid.
    """
    state_file = find_state_file(chatroom_path)
    if not state_file:
        return None

    try:
        with open(state_file) as f:
            content = f.read()

        # Empty file = still being written, fall back to parsing
        if not content.strip():
            return None

        state = json.loads(content)

        # Validate required fields exist
        if not isinstance(state, dict):
            return None
        if "agents_ready" not in state:
            return None

        return state

    except (json.JSONDecodeError, FileNotFoundError, IOError):
        # Corrupt, missing, or being written - fall back to parsing
        return None


def extract_agent_name(input_data: Dict[str, Any]) -> Optional[str]:
    """Try to extract the agent name from transcript or input."""

    # Debug: log available fields to help identify where agent name lives
    debug_log = STATE_DIR / "subagent-stop-debug.log"
    try:
        with open(debug_log, "a") as f:
            f.write(f"\n=== {datetime.now().isoformat()} ===\n")
            f.write(f"input_data keys: {list(input_data.keys())}\n")
            for key in ["subagent_type", "agent_name", "description", "prompt"]:
                if key in input_data:
                    val = str(input_data[key])[:200]
                    f.write(f"{key}: {val}\n")
    except:
        pass

    # Method 1: Check direct input fields first
    if input_data.get("subagent_type"):
        return input_data["subagent_type"]
    if input_data.get("agent_name"):
        return input_data["agent_name"]

    # Method 2: Extract from description (e.g., "github-hunter-1: Search repos")
    description = input_data.get("description", "")
    if description and ":" in description:
        candidate = description.split(":")[0].strip().lower().replace(" ", "-")
        if candidate and len(candidate) < 50:
            return candidate

    # Method 3: Search transcript for agent identity
    transcript_path = input_data.get("transcript_path")
    if not transcript_path:
        return None

    try:
        with open(transcript_path) as f:
            # Read first few lines to find agent identity
            for i, line in enumerate(f):
                if i > 20:  # Only check first 20 lines
                    break
                try:
                    entry = json.loads(line)
                    # Look for agent name in various places
                    if "agent_name" in entry:
                        return entry["agent_name"]
                    if "subagent_type" in entry:
                        return entry["subagent_type"]
                except:
                    continue
    except:
        pass

    return None


def evaluate_from_state(state: Dict[str, Any], agent_name: Optional[str]) -> Dict[str, Any]:
    """
    Evaluate coordination status from pre-computed state.
    This is MUCH faster than parsing the chatroom.
    """
    result = {
        "should_stop": False,
        "reason": "",
        "waiting_on": [],
        "has_close": False,
        "has_ready": False,
        "pending_signals": []
    }

    # Check for CLOSE signal
    if state.get("has_close"):
        result["should_stop"] = True
        result["has_close"] = True
        result["reason"] = "Orchestrator posted CLOSE signal"
        return result

    # Check if someone is WAITING on this agent
    if agent_name:
        waiting_agents = state.get("agents_waiting", {})
        waiters = [a for a, target in waiting_agents.items() if target == agent_name]
        if waiters:
            result["waiting_on"] = waiters
            result["reason"] = f"Agents waiting on @{agent_name}: {', '.join(waiters)}"
            return result

    # Check pending signals
    if state.get("agents_waiting"):
        result["pending_signals"] = list(state["agents_waiting"].keys())

    if state.get("agents_blocked"):
        result["pending_signals"].extend([
            f"BLOCKED: {a}" for a in state["agents_blocked"].keys()
        ])

    # Check if this agent already posted READY
    if agent_name and agent_name in state.get("agents_ready", []):
        result["has_ready"] = True
        if not result["waiting_on"]:
            result["should_stop"] = True
            result["reason"] = f"{agent_name} posted READY and no one waiting"
            return result

    # Check if coordination is complete
    if state.get("coordination_complete"):
        result["should_stop"] = True
        result["reason"] = "Coordination complete (all agents READY)"
        return result

    # Default: don't allow stop
    ready_count = len(state.get("agents_ready", []))
    expected = state.get("expected_count", "?")
    result["reason"] = f"Chatroom active, {ready_count}/{expected} agents READY, no CLOSE yet"
    return result


def evaluate_chatroom(content: str, agent_name: Optional[str]) -> Dict[str, Any]:
    """
    Evaluate chatroom content to determine if agent should stop.

    Returns dict with:
      - should_stop: bool
      - reason: str
      - waiting_on: list of agents waiting on this one
      - has_close: bool
      - has_ready: bool
    """
    result = {
        "should_stop": False,
        "reason": "",
        "waiting_on": [],
        "has_close": False,
        "has_ready": False,
        "pending_signals": []
    }

    # Check for CLOSE signal (orchestrator says we're done)
    if re.search(r'→\s*CLOSE', content):
        result["should_stop"] = True
        result["has_close"] = True
        result["reason"] = "Orchestrator posted CLOSE signal"
        return result

    # Check if someone is WAITING on this agent
    if agent_name:
        waiting_pattern = rf'→\s*WAITING\s+@{re.escape(agent_name)}'
        waiting_matches = re.findall(waiting_pattern, content, re.IGNORECASE)
        if waiting_matches:
            result["waiting_on"] = waiting_matches
            result["reason"] = f"Other agents are waiting on @{agent_name}"
            return result

    # Check for any WAITING signals (someone needs something)
    waiting_signals = re.findall(r'→\s*WAITING\s+@(\w+)', content)
    if waiting_signals:
        result["pending_signals"] = list(set(waiting_signals))

    # Check if this agent posted READY
    if agent_name:
        ready_pattern = rf'\[.*?\]\s*{re.escape(agent_name)}.*?→\s*READY'
        if re.search(ready_pattern, content, re.IGNORECASE | re.DOTALL):
            result["has_ready"] = True
            # If we posted READY and no one is waiting on us, we can stop
            if not result["waiting_on"]:
                result["should_stop"] = True
                result["reason"] = f"{agent_name} posted READY and no one waiting"
                return result

    # Check for any BLOCKED signals
    blocked_signals = re.findall(r'→\s*BLOCKED:\s*(.+)', content)
    if blocked_signals:
        result["pending_signals"].extend([f"BLOCKED: {b}" for b in blocked_signals])

    # Default: don't allow stop if chatroom is active
    # This is conservative - we'd rather block too much than too little
    result["reason"] = "Chatroom active, no CLOSE signal yet"
    return result


def extract_mentions_for_agent(chatroom_path: Path, agent_name: str) -> List[str]:
    """Extract chatroom posts that @mention this agent."""
    if not agent_name or not chatroom_path.exists():
        return []

    try:
        content = chatroom_path.read_text()
    except Exception:
        return []

    mentions = []
    # Pattern: ## [HH:MM] agent-name followed by content until next ## or end
    posts = re.findall(
        r'(##\s*\[[\d:]+\]\s*\S+\n.*?)(?=##\s*\[|$)',
        content,
        re.DOTALL
    )

    for post in posts:
        # Check if this post mentions our agent
        if re.search(rf'@{re.escape(agent_name)}\b', post, re.IGNORECASE):
            # Clean up and truncate if too long
            post_clean = post.strip()
            if len(post_clean) > 500:
                post_clean = post_clean[:500] + "..."
            mentions.append(post_clean)

    return mentions[-3:]  # Only last 3 mentions to avoid context bloat


def construct_block_message(
    evaluation: Dict[str, Any],
    attempt: int,
    wait_seconds: int,
    chatroom_path: Path,
    agent_name: Optional[str] = None,
    mentions: Optional[List[str]] = None
) -> str:
    """Construct a helpful message with injected context."""

    lines = [
        f"Chatroom coordination incomplete (attempt {attempt}/{MAX_ATTEMPTS})",
        ""
    ]

    # Use pre-extracted mentions or extract if not provided
    if mentions is None:
        mentions = extract_mentions_for_agent(chatroom_path, agent_name) if agent_name else []

    if mentions:
        lines.append("=" * 50)
        lines.append(f"POSTS MENTIONING @{agent_name} (respond to these):")
        lines.append("=" * 50)
        for mention in mentions:
            lines.append("")
            lines.append(mention)
        lines.append("")
        lines.append("=" * 50)
        lines.append("")
        lines.append("RESPOND to the mentions above by posting to the chatroom,")
        lines.append("then post → READY when done.")
        lines.append("")
    elif evaluation.get("waiting_on"):
        lines.append(f"ACTION REQUIRED: Agents are waiting on you!")
        lines.append(f"  Check chatroom for WAITING signals directed at you.")
        lines.append("")

    if evaluation.get("pending_signals") and not mentions:
        lines.append("Pending coordination signals:")
        for sig in evaluation["pending_signals"][:3]:
            lines.append(f"  - {sig}")
        lines.append("")

    if not mentions:
        lines.extend([
            "What to do:",
            f"  1. Read the chatroom: {chatroom_path}",
            "  2. Address any pending items or respond to waiting agents",
            "  3. Post your status: → READY (if done) or → WAITING @agent (if blocked)",
            "  4. If truly done, wait for orchestrator to post → CLOSE",
            "",
            f"If coordination is pending, wait ~{wait_seconds}s and check again.",
        ])

    lines.append("")
    lines.append(f"Reason: {evaluation.get('reason', 'Chatroom active')}")

    return "\n".join(lines)


def load_state(session_id: str) -> Dict[str, Any]:
    """Load state for this session."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{session_id}.json"

    try:
        with open(state_file) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"attempt": 0}


def save_state(session_id: str, state: Dict[str, Any]):
    """Save state for this session."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{session_id}.json"

    with open(state_file, "w") as f:
        json.dump(state, f)


def cleanup_state(session_id: str):
    """Clean up state file when we're done."""
    state_file = STATE_DIR / f"{session_id}.json"
    try:
        state_file.unlink()
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    main()
