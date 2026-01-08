#!/usr/bin/env python3
"""
PreToolUse hook to validate vault writes against schemas.

Validates that markdown files written to brain/ folders have frontmatter
that matches the required fields defined in schemas/vault/*.yaml
"""

import json
import os
import re
import sys

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def get_schema_path(file_path: str) -> str | None:
    """Map file path to its corresponding schema file."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")

    # Mapping from folder patterns to schema files
    # NOTE: Order matters! More specific paths must come first
    folder_to_schema = [
        ("brain/traces/agents/", "schemas/vault/chatroom.yaml"),
        ("brain/calls/", "schemas/vault/call.yaml"),
        ("brain/entities/", "schemas/vault/entity.yaml"),
        ("brain/inbox/", "schemas/vault/inbox.yaml"),
        ("brain/library/", "schemas/vault/library.yaml"),
        ("brain/outputs/", "schemas/vault/output.yaml"),
        ("brain/traces/", "schemas/vault/trace.yaml"),
        ("brain/notes/daily/", "schemas/vault/daily-note.yaml"),
        ("brain/notes/weekly/", "schemas/vault/weekly-note.yaml"),
    ]

    for folder, schema in folder_to_schema:
        if folder in file_path:
            return os.path.join(project_dir, schema)

    return None


def extract_frontmatter(content: str) -> dict | None:
    """Extract YAML frontmatter from markdown content."""
    # Match content between --- markers at the start
    pattern = r"^---\s*\n(.*?)\n---"
    match = re.search(pattern, content, re.DOTALL)

    if not match:
        return None

    frontmatter_text = match.group(1)

    # Use yaml library if available
    if HAS_YAML:
        try:
            return yaml.safe_load(frontmatter_text)
        except yaml.YAMLError:
            return None

    # Fallback: simple line-by-line parsing for basic key: value pairs
    result = {}
    current_key = None
    current_value = None

    for line in frontmatter_text.split("\n"):
        # Skip empty lines and comments
        if not line.strip() or line.strip().startswith("#"):
            continue

        # Check if this is a key: value line (not indented)
        if not line.startswith(" ") and ":" in line:
            # Save previous key if any
            if current_key is not None:
                result[current_key] = current_value

            key, _, value = line.partition(":")
            current_key = key.strip()
            value = value.strip()

            # Handle different value types
            if value.startswith("[") and value.endswith("]"):
                # Simple array parsing
                inner = value[1:-1]
                if inner:
                    result[current_key] = [
                        v.strip().strip("\"'") for v in inner.split(",")
                    ]
                else:
                    result[current_key] = []
                current_key = None
            elif value.startswith('"') and value.endswith('"'):
                result[current_key] = value[1:-1]
                current_key = None
            elif value.startswith("'") and value.endswith("'"):
                result[current_key] = value[1:-1]
                current_key = None
            elif value:
                result[current_key] = value
                current_key = None
            else:
                # Value might be on next line or a nested structure
                current_value = None

    # Save last key
    if current_key is not None and current_value is not None:
        result[current_key] = current_value

    return result if result else None


def extract_example_from_schema(schema_path: str) -> str | None:
    """Extract the example block from a schema file."""
    with open(schema_path) as f:
        content = f.read()

    # Find an example block (example: or example_trace: etc)
    import re

    match = re.search(r"^(example\w*):\s*\|", content, re.MULTILINE)
    if not match:
        return None

    # Get everything after the | on that line
    start = match.end()
    lines = content[start:].split("\n")
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

    return "\n".join(example_lines).strip() if example_lines else None


def get_required_fields_from_file(schema_path: str) -> tuple[list[str], dict]:
    """Extract required field names from schema file using line parsing.

    Returns tuple of (required_field_names, field_specs_dict).
    Uses line parsing instead of full YAML parsing to handle
    complex multi-line strings in schema files.
    """
    with open(schema_path) as f:
        lines = f.readlines()

    required_fields = []
    field_specs = {}

    # State machine to find frontmatter.required section
    in_frontmatter = False
    in_required = False
    current_field = None
    current_spec = {}

    for line in lines:
        stripped = line.rstrip()

        # Track when we enter frontmatter section
        if stripped == "frontmatter:":
            in_frontmatter = True
            continue

        # Track when we enter required section (2 space indent)
        if in_frontmatter and stripped == "  required:":
            in_required = True
            continue

        # Exit required section when we hit optional or leave indentation
        if in_required:
            # A line at 2-space indent that's not empty starts a new section
            if stripped and not line.startswith("    ") and line.startswith("  "):
                break
            # A line at 0 indent exits frontmatter entirely
            if stripped and not line.startswith(" "):
                break

        # Parse field names (4 space indent with colon)
        if in_required and line.startswith("    ") and not line.startswith("      "):
            # Save previous field spec
            if current_field:
                field_specs[current_field] = current_spec

            # Start new field
            if ":" in stripped:
                field_name = stripped.split(":")[0].strip()
                required_fields.append(field_name)
                current_field = field_name
                current_spec = {}

        # Parse field properties (6 space indent)
        if in_required and line.startswith("      ") and not line.startswith("        "):
            if ":" in stripped and current_field:
                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip()
                # Handle simple values
                if value and not value.startswith("|"):
                    current_spec[key] = value

    # Save last field
    if current_field:
        field_specs[current_field] = current_spec

    return required_fields, field_specs


def get_required_tag_patterns(schema_path: str) -> list[str]:
    """Extract required_patterns for tags from schema file.

    Parses the tags field's required_patterns list from the schema.
    Returns empty list if not found.
    """
    with open(schema_path) as f:
        lines = f.readlines()

    patterns = []

    # State machine to find tags.required_patterns
    in_frontmatter = False
    in_required = False
    in_tags = False
    in_required_patterns = False

    for line in lines:
        stripped = line.rstrip()

        # Track sections
        if stripped == "frontmatter:":
            in_frontmatter = True
            continue

        if in_frontmatter and stripped == "  required:":
            in_required = True
            continue

        # Find tags field (4 space indent)
        if in_required and stripped == "    tags:":
            in_tags = True
            continue

        # Exit tags when we hit another field at same level
        if in_tags and line.startswith("    ") and not line.startswith("      "):
            if stripped and ":" in stripped:
                break

        # Exit tags when we leave required section
        if in_tags and stripped and not line.startswith("    "):
            break

        # Find required_patterns (6 space indent)
        if in_tags and stripped == "      required_patterns:":
            in_required_patterns = True
            continue

        # Exit required_patterns when hitting optional_patterns or other field
        if in_required_patterns and line.startswith("      ") and not line.startswith("        "):
            if stripped and ":" in stripped:
                in_required_patterns = False
                continue

        # Parse pattern entries (8 space indent, starting with -)
        if in_required_patterns and line.startswith("        - "):
            pattern = stripped.lstrip("- ").strip().strip('"').strip("'")
            # Remove inline comments
            if "#" in pattern:
                pattern = pattern.split("#")[0].strip().strip('"').strip("'")
            if pattern:
                patterns.append(pattern)

    return patterns


def validate_tag_patterns(
    tags: list, required_patterns: list[str], schema_name: str
) -> list[str]:
    """Validate that tags contain all required patterns.

    Pattern types:
    - Literal: "call" -> exact tag must exist
    - Namespace: "client/{slug}" -> any tag starting with "client/" must exist
    - Date: "date/YYYY-MM-DD" -> any tag starting with "date/" must exist
    - Either/Or literal: "{person|company}" -> either "person" or "company" must exist
    - Either/Or namespace: "person/{slug} OR company/{slug}" -> either namespace must exist

    Returns list of error messages (empty if valid).
    """
    errors = []

    for pattern in required_patterns:
        # Handle OR patterns: "person/{slug} OR company/{slug}"
        if " OR " in pattern:
            alternatives = [p.strip() for p in pattern.split(" OR ")]
            if not any(_tag_matches_pattern(tags, alt) for alt in alternatives):
                examples = [_pattern_example(alt) for alt in alternatives]
                errors.append(
                    f"Missing required tag: one of {alternatives}\n"
                    f"    Examples: {', '.join(examples)}"
                )
            continue

        # Handle either/or literals: "{person|company}"
        if pattern.startswith("{") and "|" in pattern and pattern.endswith("}"):
            options = pattern[1:-1].split("|")
            if not any(opt in tags for opt in options):
                errors.append(
                    f"Missing required tag: one of {options}\n"
                    f"    Add one of: {', '.join(options)}"
                )
            continue

        # Handle namespace patterns: "client/{slug}", "date/YYYY-MM-DD"
        if "/" in pattern:
            namespace = pattern.split("/")[0]
            if not any(t.startswith(f"{namespace}/") for t in tags):
                errors.append(
                    f"Missing required tag namespace: {namespace}/\n"
                    f"    Example: {_pattern_example(pattern)}"
                )
            continue

        # Handle literal patterns: "call", "output"
        if pattern not in tags:
            errors.append(f"Missing required literal tag: {pattern}")

    return errors


def _tag_matches_pattern(tags: list, pattern: str) -> bool:
    """Check if any tag matches the given pattern."""
    if "/" in pattern:
        namespace = pattern.split("/")[0]
        return any(t.startswith(f"{namespace}/") for t in tags)
    return pattern in tags


def _pattern_example(pattern: str) -> str:
    """Generate an example tag for a pattern."""
    if "/" not in pattern:
        return pattern

    namespace = pattern.split("/")[0]
    template = pattern.split("/", 1)[1] if "/" in pattern else ""

    # Common replacements
    examples = {
        "YYYY-MM-DD": "2025-12-28",
        "{slug}": "example-name",
        "{topic}": "ai-strategy",
        "{type}": "linkedin-post",
        "{status}": "draft",
        "{type}-{value}": "satisfaction-high",
    }

    example_value = examples.get(template, "example")
    return f"{namespace}/{example_value}"


def validate_frontmatter(frontmatter: dict, required_fields: list[str]) -> list[str]:
    """Check which required fields are missing from frontmatter."""
    missing = []
    for field in required_fields:
        if field not in frontmatter or frontmatter[field] is None:
            missing.append(field)
    return missing


def validate_date_format(value) -> bool:
    """Check if date is in YYYY-MM-DD format or a valid date object."""
    import datetime

    # YAML parser converts dates to datetime.date objects - these are valid
    if isinstance(value, (datetime.date, datetime.datetime)):
        return True

    if not isinstance(value, str):
        return False

    # Match YYYY-MM-DD pattern
    pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(pattern, value):
        return False
    # Basic range check
    try:
        year, month, day = value.split("-")
        if not (1900 <= int(year) <= 2100):
            return False
        if not (1 <= int(month) <= 12):
            return False
        if not (1 <= int(day) <= 31):
            return False
    except ValueError:
        return False
    return True


def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Can't parse input, allow through
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only validate Write and Edit tools
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    # Get file path
    file_path = tool_input.get("file_path", "")

    # Only validate brain/ markdown files
    if "brain/" not in file_path or not file_path.endswith(".md"):
        sys.exit(0)

    # Get schema path for this file
    schema_path = get_schema_path(file_path)
    if not schema_path:
        # No schema applies to this folder
        sys.exit(0)

    # Check if schema file exists
    if not os.path.exists(schema_path):
        # Schema file doesn't exist, allow through
        sys.exit(0)

    # Get content to validate
    content = tool_input.get("content", "")

    # For Edit tool, we need to handle differently
    # Edit might be modifying existing content, so we allow it through
    # (the full validation would require reading the file first)
    if tool_name == "Edit":
        # Only validate if old_string contains frontmatter markers
        old_string = tool_input.get("old_string", "")
        if "---" not in old_string:
            sys.exit(0)
        # For frontmatter edits, we'd need more complex logic
        # Allow through for now, Write is the main case
        sys.exit(0)

    # Extract frontmatter
    frontmatter = extract_frontmatter(content)

    if frontmatter is None:
        # Get schema name for helpful message
        schema_name = os.path.basename(schema_path).replace(".yaml", "")
        example = extract_example_from_schema(schema_path)
        print(
            f"ERROR: File {os.path.basename(file_path)} requires YAML frontmatter.\n"
            f"This file should follow the '{schema_name}' schema.\n"
            f"Add frontmatter between --- markers at the start of the file.",
            file=sys.stderr,
        )
        if example:
            print(f"\nEXAMPLE:\n```\n{example}\n```", file=sys.stderr)
        sys.exit(2)

    # Load required fields from schema
    try:
        required_fields, field_specs = get_required_fields_from_file(schema_path)
    except OSError:
        # Can't read schema, allow through
        sys.exit(0)

    if not required_fields:
        # No required fields found, allow through
        sys.exit(0)

    # Validate frontmatter
    missing_fields = validate_frontmatter(frontmatter, required_fields)

    # ALWAYS show complete requirements on any error - enables recovery under context degradation
    if missing_fields:
        schema_name = os.path.basename(schema_path).replace(".yaml", "")
        print(
            f"╔══════════════════════════════════════════════════════════════════╗",
            file=sys.stderr,
        )
        print(
            f"║ SCHEMA VALIDATION ERROR: {schema_name}",
            file=sys.stderr,
        )
        print(
            f"╟──────────────────────────────────────────────────────────────────╢",
            file=sys.stderr,
        )
        print(
            f"║ ❌ Missing: {', '.join(missing_fields)}",
            file=sys.stderr,
        )
        print(
            f"╟──────────────────────────────────────────────────────────────────╢",
            file=sys.stderr,
        )
        print(
            f"║ ALL REQUIRED FIELDS (complete list for single-retry success):",
            file=sys.stderr,
        )

        # Show ALL required fields, not just missing ones
        for field in required_fields:
            field_spec = field_specs.get(field, {})
            field_type = field_spec.get("type", "unknown")
            current_val = frontmatter.get(field, "MISSING")
            status = "✓" if field not in missing_fields else "✗"

            # Show current/expected value hints
            hint = ""
            if "current" in field_spec:
                hint = f" → {field_spec['current']}"
            elif "values" in field_spec:
                hint = f" → one of: {field_spec['values']}"
            elif "value" in field_spec:
                hint = f" → {field_spec['value']}"
            elif "format" in field_spec:
                hint = f" → format: {field_spec['format']}"
            elif field_type == "string" and field in ["date"]:
                hint = " → YYYY-MM-DD"

            print(f"║   {status} {field}: {current_val}{hint}", file=sys.stderr)

        print(
            f"╟──────────────────────────────────────────────────────────────────╢",
            file=sys.stderr,
        )

        # Include example from schema
        example = extract_example_from_schema(schema_path)
        if example:
            print(f"║ COPY-PASTE TEMPLATE:", file=sys.stderr)
            for line in example.split("\n")[:15]:  # Limit to 15 lines
                print(f"║   {line}", file=sys.stderr)
        print(
            f"╚══════════════════════════════════════════════════════════════════╝",
            file=sys.stderr,
        )
        sys.exit(2)

    # Validate date format if date field exists
    date_fields = ["date", "created", "updated"]
    for field in date_fields:
        if field in frontmatter and frontmatter[field]:
            value = frontmatter[field]
            # Handle wiki-link format [[YYYY-MM-DD]]
            if isinstance(value, str) and value.startswith("[[") and value.endswith("]]"):
                value = value[2:-2]
            if not validate_date_format(value):
                print(
                    f"ERROR: Invalid date format in '{field}' field.\n"
                    f"\n"
                    f"Got: {frontmatter[field]}\n"
                    f"Expected: YYYY-MM-DD (e.g., 2025-12-28)\n"
                    f"\n"
                    f"Dates must be in ISO format for consistent sorting and queries.",
                    file=sys.stderr,
                )
                sys.exit(2)

    # Validate tag patterns if tags field exists
    tags = frontmatter.get("tags", [])
    if tags:
        # Ensure tags is a list
        if not isinstance(tags, list):
            tags = [tags]

        # Get required patterns from schema
        try:
            required_patterns = get_required_tag_patterns(schema_path)
        except OSError:
            required_patterns = []

        if required_patterns:
            schema_name = os.path.basename(schema_path).replace(".yaml", "")
            tag_errors = validate_tag_patterns(tags, required_patterns, schema_name)

            if tag_errors:
                print(
                    f"ERROR: Missing required tags for '{schema_name}' schema.\n",
                    file=sys.stderr,
                )
                for error in tag_errors:
                    print(f"  • {error}", file=sys.stderr)

                print(
                    f"\nCurrent tags: {tags}\n"
                    f"\nRequired patterns: {required_patterns}",
                    file=sys.stderr,
                )

                # Include example from schema
                example = extract_example_from_schema(schema_path)
                if example:
                    print(f"\nEXAMPLE:\n```\n{example}\n```", file=sys.stderr)
                sys.exit(2)

    # All validations passed
    sys.exit(0)


if __name__ == "__main__":
    main()
