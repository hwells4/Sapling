#!/usr/bin/env python3
"""PreCompact event router: save continuation state + git commit."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from router.framework import dispatch
from router.models import HandlerConfig
from router.handlers.continuation import save_continuation_state
from router.handlers.git import git_auto_commit_stop
from router.handlers.session_logger import log_session_summary

HANDLERS = [
    HandlerConfig(fn=save_continuation_state, name="save-continuation-state"),
]

if os.environ.get("SAPLING_ENABLE_SESSION_LOG") == "1":
    HANDLERS.append(HandlerConfig(fn=log_session_summary, name="session-log-summary"))

if os.environ.get("SAPLING_ENABLE_GIT_HOOKS") == "1":
    HANDLERS.append(HandlerConfig(fn=git_auto_commit_stop, name="git-auto-commit-stop"))

if __name__ == "__main__":
    dispatch(HANDLERS, "PreCompact")
