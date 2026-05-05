"""Centralized configuration for Sapling OS hook router.

Edit this file to adapt the router to your project structure.
All handlers import paths from here instead of hardcoding.
"""

from pathlib import Path
import os

# Project root
PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))

# Vault structure prefixes (used in path matching)
VAULT_PREFIX = "brain/"
DAILY_LOG_TEMPLATE = "brain/logs/daily/"

# Schema paths
SCHEMA_DIR = "schemas/vault/"

# Stats file (protected from direct writes)
STATS_FILE = ".claude/stats.yaml"

# State directory for continuation/dedup
STATE_DIR = PROJECT_DIR / ".claude" / "state"

# Safe directories for git auto-staging (new untracked files here are auto-staged)
SAFE_DIRS = ["brain/", "schemas/", ".claude/", ".beads/"]

# Commit message area mappings (path prefix -> area name)
# Used by git-smart-stage.sh via commit-areas.conf, but also available to Python handlers
COMMIT_AREAS = {
    "brain/logs/daily/": "daily logs",
    "brain/logs/weekly/": "weekly logs",
    "brain/logs/": "logs",
    "brain/entities/": "entities",
    "brain/calls/": "calls",
    "brain/outputs/": "outputs",
    "brain/library/": "library",
    "brain/templates/": "templates",
    "brain/context/": "context",
    "brain/": "brain",
    "schemas/": "schemas",
    ".claude/": "claude config",
    ".beads/": "beads",
}

# Skill schemas: map skill names to schema files for context injection
# Users populate this with their project-specific skill schemas.
# Format: {"skill-name": {"schema": "path/to/schema.yaml", "example_key": "example:"}}
SKILL_SCHEMAS = {}
