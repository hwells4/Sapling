#!/bin/bash
# Stop/PreCompact hook: commit all session work and push
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-${PI_PROJECT_DIR:-.}}}"
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
cd "$PROJECT_DIR" || exit 0

# Must be a git repo
[ -d .git ] || exit 0

# Nothing to commit? Exit fast.
[ -n "$(git status --porcelain)" ] || exit 0

# Load smart staging helpers + push-failure notifier
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/git-smart-stage.sh"
source "$SCRIPT_DIR/git-sync-notify.sh"

# --- Smart stage + commit ---
smart_stage >/dev/null

# Only commit if something was actually staged
if [ -n "$(git diff --cached --name-only)" ]; then
    MSG=$(build_commit_msg)
    git commit -m "$MSG" --quiet 2>/dev/null || exit 0
    echo "Auto-committed: $MSG"
else
    echo "Nothing staged (all new files were skipped)."
    exit 0
fi

# --- Push (backgrounded, but capture failure) ---
# Fire-and-forget push, but log failure if it fails.
# Run in subshell so set -e doesn't kill the parent if push fails.
(
    PUSH_ERR=$(git push --quiet 2>&1)
    PUSH_RC=$?
    if [ $PUSH_RC -ne 0 ]; then
        notify_push_failure "auto-commit push failed (exit $PUSH_RC)" "$PUSH_ERR"
    fi
) &
