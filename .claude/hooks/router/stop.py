#!/usr/bin/env python3
"""Stop event router: session logging and git auto-commit."""

import os
import sys

# Ensure the router package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from router.framework import dispatch
from router.models import HandlerConfig
from router.handlers.git import git_auto_commit_stop
from router.handlers.session_logger import log_session_summary

HANDLERS = [
    HandlerConfig(fn=log_session_summary, name="session-log-summary"),
    HandlerConfig(fn=git_auto_commit_stop, name="git-auto-commit-stop"),
]

if __name__ == "__main__":
    dispatch(HANDLERS, "Stop")
