#!/usr/bin/env python3
"""PostToolUse event router: prose checks."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from router.framework import dispatch
from router.models import HandlerConfig
from router.handlers.prose import prose_lint

HANDLERS = [
    HandlerConfig(
        fn=prose_lint,
        matcher=r"^Write$",
        name="prose-lint",
    ),
]

if __name__ == "__main__":
    dispatch(HANDLERS, "PostToolUse")
