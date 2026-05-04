"""Session handlers: init, daily note, dedup cleanup."""

import os
import subprocess
import sys
from pathlib import Path

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult


def session_init(input_data: dict) -> HandlerResult:
    """SessionStart: run session-init.sh (sets env, creates daily note)."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    script_path = os.path.join(project_dir, ".claude", "hooks", "router", "scripts", "session-init.sh")

    if not os.path.exists(script_path):
        return None

    try:
        result = subprocess.run(
            ["bash", script_path],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=project_dir,
            env={**os.environ, "CLAUDE_PROJECT_DIR": project_dir},
        )

        out = HandlerResult()
        if result.stdout.strip():
            out.additional_context = result.stdout.strip()
        if result.stderr.strip():
            out.stderr_message = result.stderr.strip()
        return out

    except subprocess.TimeoutExpired:
        return HandlerResult(stderr_message="[session] session-init.sh timed out")
    except Exception as e:
        return HandlerResult(stderr_message=f"[session] session-init.sh error: {e}")


def dedup_cleanup(input_data: dict) -> HandlerResult:
    """SessionStart[startup]: clean up memory dedup state files."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    dedup_dir = Path(project_dir) / ".claude" / "state" / "memory-dedup"

    if dedup_dir.exists():
        for log_file in dedup_dir.glob("*.log"):
            try:
                log_file.unlink()
            except Exception:
                pass

    return None
