#!/usr/bin/env python3
"""
PostToolUse hook that auto-generates migration files when schemas are updated.

Triggers after Write/Edit to schemas/vault/*.yaml files.
Generates migration template from schema changelog.
"""

import json
import os
import re
import sys
from datetime import datetime


def get_schema_name(file_path: str) -> str:
    """Extract schema name from file path."""
    return os.path.basename(file_path).replace(".yaml", "")


def parse_changelog(content: str) -> list[dict]:
    """Parse changelog entries from schema file content."""
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


def get_schema_version(content: str) -> str | None:
    """Extract current schema_version from content."""
    match = re.search(r"schema_version:\s*['\"]?(\d+\.\d+\.\d+)['\"]?", content)
    return match.group(1) if match else None


def migration_exists(project_dir: str, schema: str, from_ver: str, to_ver: str) -> bool:
    """Check if migration file already exists."""
    filename = f"{schema}-{from_ver}-to-{to_ver}.md"
    path = os.path.join(project_dir, "schemas", "migrations", filename)
    return os.path.exists(path)


def generate_migration_file(project_dir: str, schema: str, from_ver: str, to_ver: str, changes: str) -> str:
    """Generate migration file content."""
    today = datetime.now().strftime("%Y-%m-%d")

    return f"""# Migration: {schema} {from_ver} → {to_ver}

**Schema:** {schema}
**From:** {from_ver}
**To:** {to_ver}
**Generated:** {today}

## Changelog

{changes}

## Detection

Files matching:
- `schema_version: {from_ver}`
- TODO: Add additional detection criteria

## Transformation Rules

**Source pattern:**
```yaml
schema_version: {from_ver}
# TODO: Add source fields
```

**Target pattern:**
```yaml
schema_version: {to_ver}
# TODO: Add target fields
```

## Field Mappings

| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| schema_version | schema_version | Update to {to_ver} |
| TODO | TODO | TODO |

---
*Review and complete the transformation rules above.*
"""


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    file_path = tool_input.get("file_path", "")

    if "schemas/vault/" not in file_path or not file_path.endswith(".yaml"):
        sys.exit(0)

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    schema_name = get_schema_name(file_path)

    # Read the schema file
    full_path = file_path if file_path.startswith("/") else os.path.join(project_dir, file_path)

    try:
        with open(full_path) as f:
            content = f.read()
    except FileNotFoundError:
        sys.exit(0)

    # Parse changelog and current version
    changelog = parse_changelog(content)
    current_version = get_schema_version(content)

    if not changelog or not current_version:
        sys.exit(0)

    # Find the previous version (second entry in changelog)
    if len(changelog) >= 2:
        from_version = changelog[1]["version"]
        to_version = changelog[0]["version"]
        changes = changelog[0].get("changes", "No description")
    else:
        # Only one version, might be initial or legacy migration
        sys.exit(0)

    # Check if migration already exists
    if migration_exists(project_dir, schema_name, from_version, to_version):
        sys.exit(0)

    # Generate migration file
    migration_content = generate_migration_file(
        project_dir, schema_name, from_version, to_version, changes
    )

    migration_filename = f"{schema_name}-{from_version}-to-{to_version}.md"
    migration_path = os.path.join(project_dir, "schemas", "migrations", migration_filename)

    # Ensure directory exists
    os.makedirs(os.path.dirname(migration_path), exist_ok=True)

    # Write migration file
    with open(migration_path, "w") as f:
        f.write(migration_content)

    # Output notification
    print(f"\n{'='*60}")
    print(f"MIGRATION FILE GENERATED")
    print(f"{'='*60}")
    print(f"Schema: {schema_name}")
    print(f"Version: {from_version} → {to_version}")
    print(f"File: schemas/migrations/{migration_filename}")
    print(f"\nChangelog: {changes}")
    print(f"\nACTION: Complete the transformation rules in the migration file.")
    print(f"{'='*60}\n")

    sys.exit(0)


if __name__ == "__main__":
    main()
