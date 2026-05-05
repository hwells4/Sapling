"""Schema migration handler: auto-generate migration files."""

import json
import os
import re
from datetime import datetime

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult


def schema_update_prompt(input_data: dict) -> HandlerResult:
    """PostToolUse[Write|Edit]: generate migration files on schema update."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name not in ("Write", "Edit"):
        return None

    file_path = tool_input.get("file_path", "")

    if "schemas/vault/" not in file_path or not file_path.endswith(".yaml"):
        return None

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    schema_name = os.path.basename(file_path).replace(".yaml", "")

    full_path = file_path if file_path.startswith("/") else os.path.join(project_dir, file_path)

    try:
        with open(full_path) as f:
            content = f.read()
    except FileNotFoundError:
        return None

    changelog = _parse_changelog(content)
    current_version = _get_schema_version(content)

    if not changelog or not current_version:
        return None

    if len(changelog) < 2:
        return None

    from_version = changelog[1]["version"]
    to_version = changelog[0]["version"]
    changes = changelog[0].get("changes", "No description")

    migration_filename = f"{schema_name}-{from_version}-to-{to_version}.md"
    migration_path = os.path.join(project_dir, "schemas", "migrations", migration_filename)

    if os.path.exists(migration_path):
        return None

    today = datetime.now().strftime("%Y-%m-%d")
    migration_content = f"""# Migration: {schema_name} {from_version} → {to_version}

**Schema:** {schema_name}
**From:** {from_version}
**To:** {to_version}
**Generated:** {today}

## Changelog

{changes}

## Detection

Files matching:
- `schema_version: {from_version}`

## Transformation Rules

**Source pattern:**
```yaml
schema_version: {from_version}
```

**Target pattern:**
```yaml
schema_version: {to_version}
```

## Field Mappings

| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| schema_version | schema_version | Update to {to_version} |

---
*Review and complete the transformation rules above.*
"""

    os.makedirs(os.path.dirname(migration_path), exist_ok=True)
    with open(migration_path, "w") as f:
        f.write(migration_content)

    msg = (
        f"\n{'='*60}\n"
        f"MIGRATION FILE GENERATED\n"
        f"{'='*60}\n"
        f"Schema: {schema_name}\n"
        f"Version: {from_version} → {to_version}\n"
        f"File: schemas/migrations/{migration_filename}\n"
        f"\nChangelog: {changes}\n"
        f"\nACTION: Complete the transformation rules in the migration file.\n"
        f"{'='*60}\n"
    )

    return HandlerResult(additional_context=msg)


def _parse_changelog(content: str) -> list:
    changelog = []
    in_changelog = False
    current_entry = {}

    for line in content.split("\n"):
        stripped = line.strip()

        if stripped == "changelog:":
            in_changelog = True
            continue

        if in_changelog:
            if line.startswith("  - version:"):
                if current_entry:
                    changelog.append(current_entry)
                version = line.split(":", 1)[1].strip().strip("'\"")
                current_entry = {"version": version}
            elif line.startswith("    date:"):
                current_entry["date"] = line.split(":", 1)[1].strip()
            elif line.startswith("    changes:"):
                current_entry["changes"] = line.split(":", 1)[1].strip()
            elif not line.startswith(" ") and stripped and not stripped.startswith("#"):
                break

    if current_entry:
        changelog.append(current_entry)

    return changelog


def _get_schema_version(content: str) -> str:
    match = re.search(r"schema_version:\s*['\"]?(\d+\.\d+\.\d+)['\"]?", content)
    return match.group(1) if match else None
