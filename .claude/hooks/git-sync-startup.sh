#!/bin/bash
# SessionStart hook: sync with remote, commit leftover changes, push
# Runs on every session start/resume/compact/clear
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-${PI_PROJECT_DIR:-.}}}"
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
cd "$PROJECT_DIR" || exit 0

# Must be a git repo
[ -d .git ] || exit 0

# Load smart staging helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/git-smart-stage.sh"

# --- Helper: check if remote is configured ---
has_remote() {
    git remote get-url origin &>/dev/null
    return $?
}

# --- Helper: check network connectivity ---
has_network() {
    git ls-remote --exit-code origin HEAD &>/dev/null
    return $?
}

REPORT=""

# --- Early exit if no remote configured ---
if ! has_remote; then
    # Still commit locally
    if [ -n "$(git status --porcelain)" ]; then
        smart_stage >/dev/null
        if [ -n "$(git diff --cached --name-only)" ]; then
            MSG=$(build_commit_msg)
            git commit -m "$MSG" --quiet 2>/dev/null
        fi
    fi
    cat << 'GUIDANCE'
Git sync: No remote 'origin' configured. Local commits work fine.

To connect to GitHub:
  1. Create a repo at https://github.com/new
  2. Run: git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
  3. Run: git push -u origin main

After that, your work will sync automatically on session start/stop.
GUIDANCE
    exit 0
fi

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
                # Real content conflict — abort rebase
                git rebase --abort 2>/dev/null || true
                CONFLICT_LIST=$(echo "$CONFLICT_FILES" | head -5 | paste -sd, -)
                REPORT="$REPORT CONFLICT: Could not auto-merge. Files: ${CONFLICT_LIST:-unknown}. Resolve conflicts manually."

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
        git push --quiet 2>/dev/null && REPORT="$REPORT Pushed to remote."
    fi
fi

# --- Report ---
if [ -n "$REPORT" ]; then
    echo "Git sync:$REPORT"
else
    echo "Git sync: already up to date."
fi
