"""Git handlers: wraps shell scripts via subprocess."""

import os
import subprocess
import sys

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult


def _project_dir() -> str:
    return (
        os.environ.get("CLAUDE_PROJECT_DIR")
        or os.environ.get("CODEX_PROJECT_DIR")
        or os.environ.get("PI_PROJECT_DIR")
        or os.getcwd()
    )


def _run_shell(script_name: str, timeout: int = 30) -> HandlerResult:
    """Run a shell script from the hooks directory."""
    project_dir = _project_dir()
    script_path = os.path.join(project_dir, ".claude", "hooks", "router", "scripts", script_name)

    if not os.path.exists(script_path):
        return HandlerResult(stderr_message=f"[git] {script_name} not found")

    try:
        result = subprocess.run(
            ["bash", script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=project_dir,
            env={**os.environ, "CLAUDE_PROJECT_DIR": project_dir},
        )

        out = HandlerResult()
        if result.stdout.strip():
            out.additional_context = result.stdout.strip()
        if result.stderr.strip():
            out.stderr_message = result.stderr.strip()
        out.exit_code = result.returncode
        return out

    except subprocess.TimeoutExpired:
        return HandlerResult(stderr_message=f"[git] {script_name} timed out")
    except Exception as e:
        return HandlerResult(stderr_message=f"[git] {script_name} error: {e}")


def git_sync_startup(input_data: dict) -> HandlerResult:
    """SessionStart: sync with remote, commit leftovers, push."""
    return _run_shell("git-sync-startup.sh", timeout=30)


def git_auto_commit_stop(input_data: dict) -> HandlerResult:
    """Stop/PreCompact: commit all session work and push."""
    return _run_shell("git-auto-commit-stop.sh", timeout=20)
