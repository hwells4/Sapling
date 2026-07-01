"""Prose lint handler: Vale linting on client-facing outputs.

Delegates to existing prose-lint.py script.
"""

import json
import os
import subprocess

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


def prose_lint(input_data: dict) -> HandlerResult:
    """PostToolUse[Write]: lint prose in client-facing outputs.

    Delegates to existing prose-lint.py which runs Vale and
    formats detailed reports.
    """
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name != "Write":
        return None

    file_path = tool_input.get("file_path", "")

    if not file_path.endswith(".md"):
        return None

    # Check if client-facing
    client_facing_patterns = [
        "brain/outputs/email/",
        "brain/outputs/linkedin-post/",
        "brain/outputs/proposal/",
        "brain/outputs/client/",
        "brain/outputs/newsletter/",
    ]

    if not any(p in file_path for p in client_facing_patterns):
        return None

    project_dir = _project_dir()
    script_path = os.path.join(project_dir, ".claude", "hooks", "router", "scripts", "prose-lint.py")

    if not os.path.exists(script_path):
        return None

    try:
        result = subprocess.run(
            ["python3", script_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=30,
            cwd=project_dir,
        )

        out = HandlerResult()

        if result.stdout.strip():
            out.additional_context = result.stdout.strip()

        if result.stderr.strip():
            out.stderr_message = result.stderr.strip()

        return out if (out.additional_context or out.stderr_message) else None

    except subprocess.TimeoutExpired:
        return HandlerResult(stderr_message="[prose] prose-lint.py timed out")
    except Exception as e:
        return HandlerResult(stderr_message=f"[prose] prose-lint.py error: {e}")
