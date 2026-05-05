"""Skill handlers: router and context injection."""

import json
import os
import subprocess
from pathlib import Path
from typing import Optional

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult

# Map skill names to their schema files and which example block to extract
SKILL_SCHEMAS = {
    "weekly": {
        "schema": "schemas/vault/weekly-note.yaml",
        "example_key": "example:",
    },
    "scrape-linkedin": {
        "schema": "schemas/vault/library.yaml",
        "example_key": "example_external:",
    },
    "project-retrospective": {
        "schema": "schemas/vault/library.yaml",
        "example_key": "example_internal:",
    },
}


def skill_router(input_data: dict) -> HandlerResult:
    """UserPromptSubmit: evaluate prompt for skill activation suggestions."""
    prompt = input_data.get("prompt", "")
    if not prompt or not prompt.strip():
        return None

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    router_dir = Path(project_dir) / ".claude" / "hooks" / "router" / "skill-router"
    rules_path = router_dir / "skill-rules.json"
    generate_script = router_dir / "generate-rules.py"
    router_script = router_dir / "skill-router.py"

    if not router_script.exists():
        return None

    # Auto-regenerate rules if needed
    skills_dir = Path(project_dir) / ".claude" / "skills"
    regenerate = False

    if not rules_path.exists():
        regenerate = True
    elif skills_dir.exists():
        try:
            rules_mtime = rules_path.stat().st_mtime
            for skill_md in skills_dir.rglob("SKILL.md"):
                if skill_md.stat().st_mtime > rules_mtime:
                    regenerate = True
                    break
        except Exception:
            pass

    if regenerate and generate_script.exists():
        try:
            subprocess.run(
                ["python3", str(generate_script)],
                capture_output=True,
                timeout=5,
                cwd=project_dir,
            )
        except Exception:
            pass

    # Run the skill router
    try:
        result = subprocess.run(
            ["python3", str(router_script)],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=5,
            cwd=project_dir,
        )

        if result.stdout.strip():
            return HandlerResult(additional_context=result.stdout.strip())

    except (subprocess.TimeoutExpired, Exception):
        pass

    return None


def inject_skill_context(input_data: dict) -> HandlerResult:
    """PreToolUse[Skill]: inject schema templates when skills are invoked."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name != "Skill":
        return None

    skill_name = tool_input.get("skill", "")

    if skill_name not in SKILL_SCHEMAS:
        return None

    config = SKILL_SCHEMAS[skill_name]
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    schema_path = os.path.join(project_dir, config["schema"])

    example = _extract_example_block(schema_path, config["example_key"])

    if example:
        context = f"TEMPLATE from {config['schema']}:\n```yaml\n{example}\n```\nUse this template structure for the trace file."
        return HandlerResult(additional_context=context)

    return None


def _extract_example_block(schema_path: str, example_key: str) -> Optional[str]:
    """Extract an example block from a schema file."""
    if not os.path.exists(schema_path):
        return None

    with open(schema_path) as f:
        content = f.read()

    if example_key not in content:
        return None

    start = content.find(example_key)
    if start == -1:
        return None

    block_start = content.find("|", start)
    if block_start == -1:
        return None

    lines = content[block_start + 1:].split("\n")
    example_lines = []

    for line in lines:
        if not example_lines and not line.strip():
            continue
        if line and not line.startswith(" ") and not line.startswith("\t"):
            break
        example_lines.append(line)

    if example_lines:
        non_empty = [l for l in example_lines if l.strip()]
        if non_empty:
            min_indent = min(len(l) - len(l.lstrip()) for l in non_empty)
            example_lines = [l[min_indent:] if len(l) >= min_indent else l for l in example_lines]

    return "\n".join(example_lines).strip()
