#!/bin/bash
# Skill Router Hook v2.0
# Wrapper script that delegates to the Python routing engine
#
# This hook runs on UserPromptSubmit and analyzes the prompt for:
# - Keywords and patterns indicating skill relevance
# - File paths mentioned in the prompt
# - Intent patterns (what the user wants to do)
# - Directory mappings (what directories map to which skills)
#
# Configuration is auto-generated from SKILL.md files
# Manual overrides can be placed in skill-rules.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/skill-router.py"
RULES_FILE="$SCRIPT_DIR/skill-rules.json"
GENERATE_SCRIPT="$SCRIPT_DIR/generate-rules.py"

# Check if Python is available
if ! command -v python3 &>/dev/null; then
    exit 0
fi

# Check if the Python script exists
if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    exit 0
fi

# Auto-generate rules if they don't exist or skills have changed
SKILLS_DIR="$CLAUDE_PROJECT_DIR/.claude/skills"
REGENERATE=false

if [[ ! -f "$RULES_FILE" ]]; then
    REGENERATE=true
elif [[ -d "$SKILLS_DIR" ]]; then
    # Check if any SKILL.md is newer than rules file
    NEWEST_SKILL=$(find "$SKILLS_DIR" -name "SKILL.md" -newer "$RULES_FILE" 2>/dev/null | head -1)
    if [[ -n "$NEWEST_SKILL" ]]; then
        REGENERATE=true
    fi
fi

if [[ "$REGENERATE" == "true" && -f "$GENERATE_SCRIPT" ]]; then
    python3 "$GENERATE_SCRIPT" 2>/dev/null
fi

# Pipe stdin to the Python script (suppress stderr noise)
cat | python3 "$PYTHON_SCRIPT" 2>/dev/null

# Always exit 0 to allow the prompt through
exit 0
