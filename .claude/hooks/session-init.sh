#!/bin/bash
# Session initialization hook for Obsidian PKM vault
# Sets up environment variables and ensures daily note exists

# Set vault path (defaults to current directory)
export VAULT_PATH="${VAULT_PATH:-$(pwd)}"

# Date variables for daily operations
export TODAY=$(date +%Y-%m-%d)
export YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
export CURRENT_WEEK=$(date +%Y-W%V)

# Daily note path
export DAILY_NOTE="$VAULT_PATH/brain/notes/daily/$TODAY.md"

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
  if [ -f "$VAULT_PATH/.claude/skills/tmux-loop/scripts/warn-stale.sh" ]; then
    bash "$VAULT_PATH/.claude/skills/tmux-loop/scripts/warn-stale.sh"
  fi
fi
