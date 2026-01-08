#!/bin/bash
# Session initialization hook for Obsidian PKM vault
# Sets up environment variables and ensures daily note exists

# Set vault path (defaults to current directory)
VAULT_PATH="${VAULT_PATH:-$(pwd)}"

# Date variables for daily operations
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
CURRENT_WEEK=$(date +%Y-W%V)

# Daily note path
DAILY_NOTE="$VAULT_PATH/brain/notes/daily/$TODAY.md"

# Persist environment variables for all subsequent Bash commands
if [ -n "$CLAUDE_ENV_FILE" ]; then
  cat >> "$CLAUDE_ENV_FILE" << EOF
export VAULT_PATH="$VAULT_PATH"
export TODAY="$TODAY"
export YESTERDAY="$YESTERDAY"
export CURRENT_WEEK="$CURRENT_WEEK"
export DAILY_NOTE="$DAILY_NOTE"
EOF
fi

# Verify vault structure (check for CLAUDE.md at root)
if [ ! -f "$VAULT_PATH/CLAUDE.md" ]; then
    echo "Note: Not in a SaplingOS directory (no CLAUDE.md found)"
fi

# Output session info
echo ""
echo "Launching your Personal OS"
echo "  Today: $TODAY"

# Ensure daily note exists (creates from schema if missing)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/daily-init.py"

# Check for completed loops since last session
COMPLETIONS_FILE="$VAULT_PATH/.claude/loop-completions.json"
if [ -f "$COMPLETIONS_FILE" ]; then
  if command -v jq &> /dev/null; then
    COUNT=$(jq 'length' "$COMPLETIONS_FILE" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ]; then
      echo ""
      echo "✅ COMPLETED LOOPS SINCE LAST SESSION:"
      jq -r '.[] | "  \(.status): loop-\(.session) at \(.completed_at)"' "$COMPLETIONS_FILE"
      # Clear the file after displaying
      rm "$COMPLETIONS_FILE"
    fi
  else
    # Fallback without jq
    echo ""
    echo "✅ LOOPS COMPLETED (install jq for details):"
    cat "$COMPLETIONS_FILE"
    rm "$COMPLETIONS_FILE"
  fi
fi

# Check for running tmux loop sessions
LOOP_SESSIONS=$(tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^loop-" | wc -l | tr -d ' ')
if [ "$LOOP_SESSIONS" -gt 0 ]; then
  echo ""
  echo "⚠️  RUNNING LOOP SESSIONS: $LOOP_SESSIONS"
  tmux list-sessions 2>/dev/null | grep "^loop-"
  echo ""
  echo "  Check:  tmux capture-pane -t SESSION -p | tail -20"
  echo "  Attach: tmux attach -t SESSION"

  # Check for stale sessions (>2 hours)
  if [ -f "$VAULT_PATH/.claude/skills/run-loop/scripts/warn-stale.sh" ]; then
    bash "$VAULT_PATH/.claude/skills/run-loop/scripts/warn-stale.sh"
  fi
fi
