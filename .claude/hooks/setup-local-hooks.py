#!/usr/bin/env python3
"""Configure a machine-local Claude Code hook profile for SaplingOS."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SETTINGS_PATH = ROOT / ".claude" / "settings.local.json"


def build_settings(profile: str) -> dict:
    has_memory_tool = bool(shutil.which("qmd") or shutil.which("cm"))

    env = {
        "VAULT_PATH": "${cwd}/brain",
        "SAPLING_HOOKS_PROFILE": profile,
        "SAPLING_ENABLE_DAILY_HOOK": "1",
        "SAPLING_ENABLE_SESSION_LOG": "1",
        "SAPLING_ENABLE_SKILL_ROUTER": "1",
        "SAPLING_ENABLE_MEMORY_HOOK": "1" if has_memory_tool else "0",
        "SAPLING_ENABLE_GIT_HOOKS": "1" if profile == "recommended" else "0",
    }

    return {
        "$schema": "https://json.schemastore.org/claude-code-settings.json",
        "env": env,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        choices=("recommended", "no-git"),
        default="recommended",
        help="Hook profile to write. Default: recommended, with git automation enabled.",
    )
    parser.add_argument(
        "--print",
        action="store_true",
        help="Print the generated settings instead of writing settings.local.json.",
    )
    args = parser.parse_args()

    settings = build_settings(args.profile)
    rendered = json.dumps(settings, indent=2) + "\n"

    if args.print:
        print(rendered, end="")
        return 0

    SETTINGS_PATH.write_text(rendered)
    print(f"Wrote {SETTINGS_PATH.relative_to(ROOT)} with '{args.profile}' hook profile.")
    if settings["env"]["SAPLING_ENABLE_MEMORY_HOOK"] == "0":
        print("Memory hook disabled because neither qmd nor cm was found on PATH.")
    if settings["env"]["SAPLING_ENABLE_GIT_HOOKS"] == "1":
        print("Git auto-commit/push hook behavior is enabled. Use --profile no-git to opt out while keeping core hooks.")
    else:
        print("Git auto-commit/push hook behavior is disabled.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
