#!/usr/bin/env python3
"""PreToolUse event router: validation gates and context injection."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from router.framework import dispatch
from router.models import HandlerConfig
from router.handlers.vault import stats_protection, validate_vault_schema
from router.handlers.skills import inject_skill_context

HANDLERS = [
    HandlerConfig(
        fn=stats_protection,
        matcher=r"Write|Edit",
        name="stats-protection",
    ),
    HandlerConfig(
        fn=validate_vault_schema,
        matcher=r"^Write$",
        name="validate-vault-schema",
    ),
    HandlerConfig(
        fn=inject_skill_context,
        matcher=r"^Skill$",
        name="inject-skill-context",
    ),
]

if __name__ == "__main__":
    dispatch(HANDLERS, "PreToolUse")
