#!/bin/bash
# SessionStart hook: sync with remote, commit leftover changes, push
# Runs on every session start/resume/compact/clear
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-${PI_PROJECT_DIR:-.}}}"
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
cd "$PROJECT_DIR" || exit 0

# Must be a git repo
[ -d .git ] || exit 0

# Load smart staging helpers + push-failure notifier
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/git-smart-stage.sh"
source "$SCRIPT_DIR/git-sync-notify.sh"

# --- Helper: check network connectivity ---
has_network() {
    git ls-remote --exit-code origin HEAD &>/dev/null
    return $?
}

REPORT=""

# --- 1. Fetch from remote ---
if has_network; then
    git fetch origin --quiet 2>/dev/null && REPORT="Fetched from origin."
else
    REPORT="Offline — skipping remote sync."
    # Still commit locally if needed
    if [ -n "$(git status --porcelain)" ]; then
        smart_stage >/dev/null
        if [ -n "$(git diff --cached --name-only)" ]; then
            MSG=$(build_commit_msg)
            git commit -m "$MSG" --quiet 2>/dev/null
            REPORT="$REPORT Committed leftover changes locally ($MSG)."
        fi
    fi
    echo "$REPORT"
    exit 0
fi

# --- 2. Pull if behind remote ---
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")

    if [ "$BEHIND" -gt 0 ]; then
        if git pull --ff-only --quiet 2>/dev/null; then
            REPORT="$REPORT Pulled $BEHIND commit(s) (fast-forward)."
        elif git pull --rebase --quiet 2>/dev/null; then
            REPORT="$REPORT Pulled $BEHIND commit(s) (rebased)."
        else
            # Rebase failed — check if conflicts are frontmatter-only
            CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
            ALL_FRONTMATTER=true

            if [ -n "$CONFLICT_FILES" ]; then
                while IFS= read -r cfile; do
                    [ -z "$cfile" ] && continue
                    # Check if conflict markers are only in YAML frontmatter (before second ---)
                    if [ -f "$cfile" ]; then
                        # Get line number of closing ---
                        FRONTMATTER_END=$(awk '/^---$/{n++; if(n==2){print NR; exit}}' "$cfile" 2>/dev/null || echo "0")
                        # Get line numbers of conflict markers
                        CONFLICT_LINES=$(grep -n '^<<<<<<< \|^=======$\|^>>>>>>> ' "$cfile" 2>/dev/null | head -1 | cut -d: -f1 || echo "999999")

                        if [ "$FRONTMATTER_END" -eq 0 ] || [ "$CONFLICT_LINES" -gt "$FRONTMATTER_END" ]; then
                            ALL_FRONTMATTER=false
                            break
                        fi
                    fi
                done <<< "$CONFLICT_FILES"
            else
                ALL_FRONTMATTER=false
            fi

            if $ALL_FRONTMATTER && [ -n "$CONFLICT_FILES" ]; then
                # Auto-resolve: take theirs for frontmatter (remote is more recent)
                while IFS= read -r cfile; do
                    [ -z "$cfile" ] && continue
                    git checkout --theirs -- "$cfile" 2>/dev/null
                    git add -- "$cfile" 2>/dev/null
                done <<< "$CONFLICT_FILES"
                git rebase --continue 2>/dev/null || git commit --no-edit --quiet 2>/dev/null || true
                REPORT="$REPORT Auto-resolved frontmatter conflicts in: $(echo "$CONFLICT_FILES" | paste -sd, -)."
            else
                # Real content conflict — abort rebase, spawn agent
                git rebase --abort 2>/dev/null || true
                CONFLICT_LIST=$(echo "$CONFLICT_FILES" | head -5 | paste -sd, -)
                REPORT="$REPORT CONFLICT: Could not auto-merge. Files: ${CONFLICT_LIST:-unknown}."

                # Spawn background agent to handle conflict
                if command -v tmux &>/dev/null; then
                    AGENT_CMD="cd '$PROJECT_DIR' && claude --dangerously-skip-permissions -p 'Git merge conflict detected. Files with conflicts: ${CONFLICT_LIST:-unknown}. Please: 1) Run git status to see the state 2) Examine the conflicting files 3) Resolve the conflicts by choosing the right content 4) Stage and commit the resolution 5) Push to remote. Be careful - read both versions before choosing.'"
                    tmux new-session -d -s "git-conflict-resolver" bash -c "$AGENT_CMD" 2>/dev/null \
                        && REPORT="$REPORT Spawned conflict resolver agent (tmux: git-conflict-resolver)." \
                        || REPORT="$REPORT Could not spawn agent. Resolve manually."
                else
                    REPORT="$REPORT Resolve conflicts manually."
                fi

                echo "Git sync:$REPORT"
                exit 0
            fi
        fi
    fi
fi

# --- 3. Commit leftover local changes (smart staging) ---
if [ -n "$(git status --porcelain)" ]; then
    smart_stage >/dev/null
    if [ -n "$(git diff --cached --name-only)" ]; then
        MSG=$(build_commit_msg)
        git commit -m "$MSG" --quiet 2>/dev/null
        REPORT="$REPORT Committed leftover changes ($MSG)."
    fi
fi

# --- 4. Push ---
if has_network; then
    AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
    if [ "$AHEAD" -gt 0 ]; then
        PUSH_ERR=$(git push --quiet 2>&1)
        PUSH_RC=$?
        if [ $PUSH_RC -eq 0 ]; then
            REPORT="$REPORT Pushed $AHEAD commit(s) to remote."
        else
            notify_push_failure "startup-sync push failed (exit $PUSH_RC)" "$PUSH_ERR"
            REPORT="$REPORT PUSH FAILED ($AHEAD commit(s) unpushed)."
        fi
    fi
fi

# --- Report ---
if [ -n "$REPORT" ]; then
    echo "Git sync:$REPORT"
else
    echo "Git sync: already up to date."
fi
