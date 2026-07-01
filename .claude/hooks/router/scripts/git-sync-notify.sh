#!/bin/bash
# Shared notifier for git sync failures.
# Source this file, then call: notify_push_failure "<reason>" [<push_stderr>]
#
# Side effects:
#   1. echo to stderr (visible in Claude session output)
#   2. append to project hook state (persistent record)

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-${PI_PROJECT_DIR:-.}}}"
GIT_SYNC_FAILURE_LOG="${GIT_SYNC_FAILURE_LOG:-$PROJECT_DIR/.claude/state/git-sync-failures.log}"

notify_push_failure() {
    local reason="$1"
    local detail="${2:-}"
    local repo
    repo="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo unknown)")"
    local host
    host="$(hostname -s 2>/dev/null || echo unknown)"
    local branch
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    local ahead
    ahead="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "?")"
    local timestamp
    timestamp="$(date -Iseconds)"

    local msg="git sync failure on ${host}: ${repo}@${branch} - ${reason} (${ahead} commits unpushed)"
    [ -n "$detail" ] && msg="${msg}
${detail}"

    # 1. stderr — visible in Claude output
    echo "[git-sync] $msg" >&2

    # 2. persistent log
    mkdir -p "$(dirname "$GIT_SYNC_FAILURE_LOG")" 2>/dev/null
    {
        echo "[$timestamp] $msg"
        [ -n "$detail" ] && echo "  detail: $detail"
    } >> "$GIT_SYNC_FAILURE_LOG" 2>/dev/null

}
