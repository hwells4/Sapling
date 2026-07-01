#!/usr/bin/env python3
from __future__ import annotations
"""
Ensure today's daily log exists, creating from schema if needed.

Called by session-init.sh on startup to guarantee a daily log is ready.
Reads the template from schemas/vault/daily-log.yaml so schema changes
propagate automatically.
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path


def get_week_number(date: datetime) -> str:
    """Get ISO week number in YYYY-Www format."""
    return date.strftime("%Y-W%V")


def get_month(date: datetime) -> str:
    """Get month in YYYY-MM format."""
    return date.strftime("%Y-%m")


def get_day_name(date: datetime) -> str:
    """Get full day name like 'Saturday, December 28, 2025'."""
    return date.strftime("%A, %B %d, %Y").replace(" 0", " ")


def extract_example_from_schema(schema_path: Path) -> str | None:
    """Extract the example: block from the schema file."""
    if not schema_path.exists():
        return None

    content = schema_path.read_text()

    # Find "example: |" and extract the indented block
    if "example: |" not in content:
        return None

    start = content.find("example: |")
    if start == -1:
        return None

    # Get everything after "example: |"
    block_start = content.find("|", start)
    lines = content[block_start + 1 :].split("\n")
    example_lines = []

    for line in lines:
        # Skip first empty line after |
        if not example_lines and not line.strip():
            continue
        # Stop at non-indented non-empty line (next YAML key)
        if line and not line.startswith(" ") and not line.startswith("\t"):
            break
        example_lines.append(line)

    # Remove common leading whitespace
    if example_lines:
        non_empty = [l for l in example_lines if l.strip()]
        if non_empty:
            min_indent = min(len(l) - len(l.lstrip()) for l in non_empty)
            example_lines = [
                l[min_indent:] if len(l) >= min_indent else l for l in example_lines
            ]

    return "\n".join(example_lines).strip()


def generate_daily_log(date: datetime, template: str) -> str:
    """Generate a daily log by replacing placeholders in the template."""
    import re

    yesterday = date - timedelta(days=1)
    tomorrow = date + timedelta(days=1)

    date_str = date.strftime("%Y-%m-%d")
    yesterday_str = yesterday.strftime("%Y-%m-%d")
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    week = get_week_number(date)
    month = get_month(date)
    day_name = get_day_name(date)

    note = template

    # Infer the example date from schema frontmatter instead of hardcoding it.
    example_date = None
    match = re.search(r"^date:\s*(\d{4}-\d{2}-\d{2})", note, re.MULTILINE)
    if match:
        try:
            example_date = datetime.strptime(match.group(1), "%Y-%m-%d")
        except ValueError:
            example_date = None

    if example_date:
        example_date_str = example_date.strftime("%Y-%m-%d")
        example_yesterday = (example_date - timedelta(days=1)).strftime("%Y-%m-%d")
        example_tomorrow = (example_date + timedelta(days=1)).strftime("%Y-%m-%d")

        # Replace navigation first using placeholders to avoid collisions.
        note = note.replace(example_yesterday, "__YESTERDAY__")
        note = note.replace(example_tomorrow, "__TOMORROW__")
        note = note.replace(example_date_str, date_str)
        note = note.replace("__YESTERDAY__", yesterday_str)
        note = note.replace("__TOMORROW__", tomorrow_str)

    # Replace week reference (handles different week numbers)
    note = re.sub(r"\[\[ops/weekly/\d{4}-W\d{2}\]\]", f"[[ops/weekly/{week}]]", note)
    note = re.sub(r"\[\[logs/weekly/\d{4}-W\d{2}\]\]", f"[[ops/weekly/{week}]]", note)

    # Replace month reference
    note = re.sub(r"\[\[ops/monthly/\d{4}-\d{2}\]\]", f"[[ops/monthly/{month}]]", note)
    note = re.sub(r"\[\[logs/monthly/\d{4}-\d{2}\]\]", f"[[ops/monthly/{month}]]", note)

    # Replace the title line (Friday, December 27, 2025)
    day_pattern = r"# \w+, \w+ \d+, \d+"
    note = re.sub(day_pattern, f"# {day_name}", note)

    # Clear out the example content - start fresh.
    note = re.sub(
        r"### In-System\n.*?(?=### Async)",
        "### In-System\n*None yet*\n\n",
        note,
        flags=re.DOTALL,
    )
    note = re.sub(
        r"### Async\n.*?(?=### Needs Input)",
        "### Async\n*None yet*\n\n",
        note,
        flags=re.DOTALL,
    )
    note = re.sub(
        r"### Needs Input\n.*?(?=## Created Today)",
        "### Needs Input\n*None yet*\n\n",
        note,
        flags=re.DOTALL,
    )

    # Clear decisions and reflection content but keep structure
    note = re.sub(
        r"## Decisions Made\n.*?(?=## Evening Reflection)",
        "## Decisions Made\n*None yet*\n\n",
        note,
        flags=re.DOTALL,
    )

    # Clear reflection ratings and content
    note = re.sub(r"\*\*Energy:\*\* \d/5", "**Energy:** /5", note)
    note = re.sub(r"\*\*Focus:\*\* \d/5", "**Focus:** /5", note)
    note = re.sub(
        r"### What worked:\n.*?(?=### What didn't:)",
        "### What worked:\n\n",
        note,
        flags=re.DOTALL,
    )
    note = re.sub(
        r"### What didn't:\n.*?(?=### Tomorrow's priority:)",
        "### What didn't:\n\n",
        note,
        flags=re.DOTALL,
    )
    note = re.sub(r"### Tomorrow's priority:\n.*$", "### Tomorrow's priority:\n", note)

    # Clear focus section
    note = re.sub(r"## Focus\n.*?(?=## Tasks)", "## Focus\n\n", note, flags=re.DOTALL)
    note = re.sub(
        r"## Focus\n.*?(?=## Commitments)",
        "## Focus\n\n",
        note,
        flags=re.DOTALL,
    )

    return note


def main():
    project_dir = (
        os.environ.get("CLAUDE_PROJECT_DIR")
        or os.environ.get("CODEX_PROJECT_DIR")
        or os.environ.get("PI_PROJECT_DIR")
        or os.getcwd()
    )
    today = datetime.now()
    date_str = today.strftime("%Y-%m-%d")

    daily_log_path = Path(project_dir) / "brain" / "ops" / "daily" / f"{date_str}.md"
    schema_path = Path(project_dir) / "schemas" / "vault" / "daily-log.yaml"

    # Check if daily log already exists
    if daily_log_path.exists():
        print(f"  Daily log: {daily_log_path.relative_to(project_dir)}")
        sys.exit(0)

    # Extract template from schema
    template = extract_example_from_schema(schema_path)
    if not template:
        print(f"  Warning: Could not read daily log schema from {schema_path}")
        sys.exit(1)

    # Generate the log
    log_content = generate_daily_log(today, template)

    # Ensure directory exists
    daily_log_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the log
    daily_log_path.write_text(log_content)
    print(f"  Daily log: {daily_log_path.relative_to(project_dir)} (created)")

    sys.exit(0)


if __name__ == "__main__":
    main()
