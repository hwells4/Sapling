"""Centralized configuration for Sapling OS hook router.

Edit this file to adapt the router to your project structure.
All handlers import paths from here instead of hardcoding.
"""

from pathlib import Path
import os

# Project root. Claude, Codex, and Pi expose different project env names.
PROJECT_DIR = Path(
    os.environ.get("CLAUDE_PROJECT_DIR")
    or os.environ.get("CODEX_PROJECT_DIR")
    or os.environ.get("PI_PROJECT_DIR")
    or "."
)

# Vault structure prefixes (used in path matching)
VAULT_PREFIX = "brain/"
DAILY_LOG_TEMPLATE = "brain/ops/daily/"

# Schema paths
SCHEMA_DIR = "schemas/vault/"

# Stats file (protected from direct writes)
STATS_FILE = ".claude/stats.yaml"

# State directory for continuation/dedup
STATE_DIR = PROJECT_DIR / ".claude" / "state"

# Safe directories for git auto-staging (new untracked files here are auto-staged)
SAFE_DIRS = ["brain/", "schemas/", ".claude/", ".agents/", ".codex/", ".pi/", ".beads/"]

# Commit message area mappings (path prefix -> area name)
# Used by git-smart-stage.sh via commit-areas.conf, but also available to Python handlers
COMMIT_AREAS = {
    "brain/ops/daily/": "daily logs",
    "brain/ops/weekly/": "weekly logs",
    "brain/ops/": "ops",
    "brain/wiki/": "wiki",
    "brain/raw/": "raw sources",
    "brain/outputs/": "outputs",
    "brain/logs/": "legacy logs",
    "brain/entities/": "legacy entities",
    "brain/calls/": "legacy calls",
    "brain/library/": "legacy library",
    "brain/context/": "legacy context",
    "brain/": "brain",
    "schemas/": "schemas",
    ".claude/": "claude config",
    ".agents/": "codex config",
    ".codex/": "codex config",
    ".pi/": "pi config",
    ".beads/": "beads",
}

# Skill schemas: map skill names to schema files for context injection
# Users populate this with their project-specific skill schemas.
# Format: {"skill-name": {"schema": "path/to/schema.yaml", "example_key": "example:"}}
SKILL_SCHEMAS = {}
