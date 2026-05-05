#!/usr/bin/env python3
from __future__ import annotations
"""
PostToolUse hook to lint prose in client-facing outputs.

Runs Vale on markdown files written to external-facing output directories:
- brain/outputs/email/**
- brain/outputs/linkedin-post/**
- brain/outputs/proposal/**
- brain/outputs/client/**

Only warns (doesn't block) - surfaces issues for agent to fix.
"""

import json
import os
import subprocess
import sys


# Patterns that indicate client-facing content
CLIENT_FACING_PATTERNS = [
    "brain/outputs/email/",
    "brain/outputs/linkedin-post/",
    "brain/outputs/proposal/",
    "brain/outputs/client/",
    "brain/outputs/newsletter/",
]

# Minimum issue count to report (avoid noise for minor issues)
MIN_WARNINGS_TO_REPORT = 1
MIN_ERRORS_TO_REPORT = 1


def is_client_facing(file_path: str) -> bool:
    """Check if file is in a client-facing output directory."""
    return any(pattern in file_path for pattern in CLIENT_FACING_PATTERNS)


def find_vale() -> str | None:
    """Find vale executable in common locations."""
    # Common paths for vale
    paths = [
        "/opt/homebrew/bin/vale",  # Homebrew on Apple Silicon
        "/usr/local/bin/vale",      # Homebrew on Intel/Linux
        "/usr/bin/vale",            # System install
    ]

    for path in paths:
        if os.path.exists(path):
            return path

    # Try PATH as fallback
    import shutil
    return shutil.which("vale")


def run_vale(file_path: str) -> dict:
    """Run Vale on file and return parsed results."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    vale_config = os.path.join(project_dir, ".vale.ini")

    # Check if vale config exists
    if not os.path.exists(vale_config):
        return {"error": "Vale config not found"}

    # Find vale executable
    vale_path = find_vale()
    if not vale_path:
        return {"error": "Vale not installed"}

    try:
        result = subprocess.run(
            [vale_path, "--config", vale_config, "--output", "JSON", file_path],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=project_dir,
        )

        if result.stdout:
            return json.loads(result.stdout)
        return {}

    except subprocess.TimeoutExpired:
        return {"error": "Vale timed out"}
    except json.JSONDecodeError:
        return {"error": "Failed to parse Vale output"}
    except FileNotFoundError:
        return {"error": "Vale not installed"}


def format_issues(vale_output: dict, file_path: str) -> tuple[list, list, list]:
    """Extract and format issues by severity."""
    errors = []
    warnings = []
    suggestions = []

    # Vale output is keyed by file path
    for path, issues in vale_output.items():
        if not isinstance(issues, list):
            continue

        for issue in issues:
            severity = issue.get("Severity", "suggestion")
            line = issue.get("Line", "?")
            message = issue.get("Message", "")
            check = issue.get("Check", "")
            match = issue.get("Match", "")

            formatted = f"L{line}: {message}"
            if match:
                formatted += f" ('{match}')"

            # Group AILint issues separately for emphasis
            if "AILint" in check:
                formatted = f"🤖 {formatted}"

            if severity == "error":
                errors.append(formatted)
            elif severity == "warning":
                warnings.append(formatted)
            else:
                suggestions.append(formatted)

    return errors, warnings, suggestions


def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only check Write tool
    if tool_name != "Write":
        sys.exit(0)

    file_path = tool_input.get("file_path", "")

    # Only check markdown files
    if not file_path.endswith(".md"):
        sys.exit(0)

    # Only check client-facing outputs
    if not is_client_facing(file_path):
        sys.exit(0)

    # Run Vale
    vale_output = run_vale(file_path)

    if "error" in vale_output:
        # Vale failed, but don't block the write
        print(f"⚠️ Prose lint skipped: {vale_output['error']}", file=sys.stderr)
        sys.exit(0)

    # Format issues
    errors, warnings, suggestions = format_issues(vale_output, file_path)

    # Check if we have enough issues to report
    if len(errors) < MIN_ERRORS_TO_REPORT and len(warnings) < MIN_WARNINGS_TO_REPORT:
        # Clean output, no report needed
        sys.exit(0)

    # Build report
    total_issues = len(errors) + len(warnings) + len(suggestions)
    ai_lint_count = sum(1 for i in errors + warnings + suggestions if "🤖" in i)

    print(f"\n╔══════════════════════════════════════════════════════════════════╗")
    print(f"║ 📝 PROSE LINT: {os.path.basename(file_path)}")
    print(f"║ {total_issues} issues ({ai_lint_count} AI tells)")
    print(f"╟──────────────────────────────────────────────────────────────────╢")

    if errors:
        print(f"║ ❌ ERRORS ({len(errors)}):")
        for e in errors[:5]:  # Limit to first 5
            print(f"║   {e}")
        if len(errors) > 5:
            print(f"║   ... and {len(errors) - 5} more")

    if warnings:
        print(f"║ ⚠️  WARNINGS ({len(warnings)}):")
        for w in warnings[:8]:  # Limit to first 8
            print(f"║   {w}")
        if len(warnings) > 8:
            print(f"║   ... and {len(warnings) - 8} more")

    if suggestions and len(suggestions) <= 5:
        print(f"║ 💡 SUGGESTIONS ({len(suggestions)}):")
        for s in suggestions:
            print(f"║   {s}")
    elif suggestions:
        print(f"║ 💡 SUGGESTIONS: {len(suggestions)} items (run /polish for full report)")

    print(f"╟──────────────────────────────────────────────────────────────────╢")
    print(f"║ Consider fixing these issues before sending to clients.")
    print(f"║ Run /polish for AI-powered rewriting assistance.")
    print(f"╚══════════════════════════════════════════════════════════════════╝")

    # Don't block - just inform
    sys.exit(0)


if __name__ == "__main__":
    main()
