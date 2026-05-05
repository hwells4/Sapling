"""Vault handlers: stats protection and schema validation.

These are thin wrappers that delegate to the existing Python scripts,
since validate-vault-schema.py is complex (623 lines) and tested.
"""

import json
import os
import subprocess

try:
    from ..models import Decision, HandlerResult
except ImportError:
    from models import Decision, HandlerResult


def stats_protection(input_data: dict) -> HandlerResult:
    """PreToolUse[Write|Edit]: block direct writes to stats.yaml."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name not in ("Write", "Edit", "MultiEdit"):
        return None

    file_path = tool_input.get("file_path", "")

    if ".claude/stats.yaml" in file_path:
        return HandlerResult(
            decision=Decision.BLOCK,
            reason="stats.yaml is managed by Sapling onboarding and calibration workflows. Use /onboard for setup changes instead of editing it directly.",
        )

    return None


def validate_vault_schema(input_data: dict) -> HandlerResult:
    """PreToolUse[Write]: validate vault writes against schemas.

    Delegates to the existing validate-vault-schema.py script since
    it contains complex schema parsing logic that's well-tested.
    """
    tool_name = input_data.get("tool_name", "")

    if tool_name not in ("Write", "Edit"):
        return None

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if "brain/" not in file_path or not file_path.endswith(".md"):
        return None

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    script_path = os.path.join(project_dir, ".claude", "hooks", "router", "scripts", "validate-vault-schema.py")

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

        if result.returncode == 2:
            out.decision = Decision.BLOCK
            out.exit_code = 2
            if result.stderr.strip():
                out.stderr_message = result.stderr.strip()
                out.reason = "Vault schema validation failed. See stderr for details."
        elif result.stdout.strip():
            out.additional_context = result.stdout.strip()

        if result.stderr.strip() and result.returncode != 2:
            out.stderr_message = result.stderr.strip()

        return out if (out.decision != Decision.NONE or out.additional_context or out.stderr_message) else None

    except subprocess.TimeoutExpired:
        return HandlerResult(stderr_message="[vault] validate-vault-schema.py timed out")
    except Exception as e:
        return HandlerResult(stderr_message=f"[vault] validate-vault-schema.py error: {e}")
