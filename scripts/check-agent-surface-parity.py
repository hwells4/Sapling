#!/usr/bin/env python3
"""Check that shared agent-facing Sapling surfaces do not drift."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SHARED_SKILL_PATHS = [
    Path(".claude/skills/sapling-brain/SKILL.md"),
    Path(".agents/skills/sapling-brain/SKILL.md"),
    Path(".pi/skills/sapling-brain/SKILL.md"),
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    missing = [str(path) for path in SHARED_SKILL_PATHS if not (ROOT / path).exists()]
    if missing:
        print("Missing shared skill files:")
        for path in missing:
            print(f"  - {path}")
        return 1

    hashes = {str(path): digest(ROOT / path) for path in SHARED_SKILL_PATHS}
    unique = set(hashes.values())
    if len(unique) != 1:
        print("Sapling agent skill files have drifted:")
        for path, value in hashes.items():
            print(f"  - {path}: {value}")
        return 1

    print("Agent surfaces aligned: sapling-brain skill is identical for Claude, Codex, and Pi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
