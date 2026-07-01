"""Continuation state: save/load across compaction."""

import json
import os
import re
from datetime import datetime
from pathlib import Path

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult

STATE_DIR = Path(
    os.environ.get("CLAUDE_PROJECT_DIR")
    or os.environ.get("CODEX_PROJECT_DIR")
    or os.environ.get("PI_PROJECT_DIR")
    or "."
) / ".claude" / "state"
STATE_FILE = STATE_DIR / "continuation.md"


def save_continuation_state(input_data: dict) -> HandlerResult:
    """PreCompact: save session state before context compaction."""
    session_id = input_data.get("session_id", "unknown")
    compaction_type = input_data.get("matcher", "auto")

    today = datetime.now().strftime("%Y-%m-%d")

    state_content = f"""---
saved_at: {datetime.now().isoformat()}
session_id: {session_id}
compaction_type: {compaction_type}
---

# Continuation State

This file was auto-saved before context compaction. Read this to resume your work.

## Session Context

- **Compaction Type:** {compaction_type}
- **Saved At:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Active Work

Check these locations for in-progress work:

1. **Todo list:** The TodoWrite tool may have tracked progress
2. **Daily log:** `brain/ops/daily/{today}.md`

## Post-Compaction Instructions

1. Read the daily log to understand what was being worked on
2. Continue from where you left off
"""

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(state_content)

    return HandlerResult(
        additional_context="CONTINUATION STATE SAVED: Before this compaction, state was saved to .claude/state/continuation.md. After compaction, read this file to resume your work.",
    )


def load_continuation_state(input_data: dict) -> HandlerResult:
    """SessionStart[compact]: load saved state after compaction."""
    if not STATE_FILE.exists():
        return None

    try:
        state_content = STATE_FILE.read_text()
    except Exception:
        return None

    # Check freshness (within last hour)
    try:
        match = re.search(r'saved_at: (\d{4}-\d{2}-\d{2}T[\d:.]+)', state_content)
        if match:
            saved_at = datetime.fromisoformat(match.group(1))
            age_minutes = (datetime.now() - saved_at).total_seconds() / 60
            if age_minutes > 60:
                return None
    except Exception:
        pass

    return HandlerResult(
        additional_context="""SESSION RESUMED AFTER COMPACTION

Your previous session ran out of context and was compacted.
Saved state is available at: .claude/state/continuation.md

IMMEDIATE ACTIONS:
1. Read .claude/state/continuation.md for saved context
2. Check your todo list (if you were using TodoWrite)
3. Resume the task you were working on

DO NOT start a new task. Continue your previous work.""",
    )
