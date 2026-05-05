#!/bin/bash
# Session initialization hook for Obsidian PKM vault
# Sets up environment variables and ensures daily log exists

# Set vault path (defaults to current directory)
export VAULT_PATH="${VAULT_PATH:-$(pwd)}"

# Date variables for daily operations
export TODAY=$(date +%Y-%m-%d)
export YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
export CURRENT_WEEK=$(date +%Y-W%V)

# Daily log path
export DAILY_LOG="$VAULT_PATH/brain/logs/daily/$TODAY.md"

# Verify vault structure
if [ ! -d "$VAULT_PATH/brain" ] || [ ! -f "$VAULT_PATH/CLAUDE.md" ]; then
    echo "Note: Not in a SaplingOS root directory"
fi

# Output session info
echo ""
echo "Launching your Personal OS"
echo "  Today: $TODAY"

# Ensure daily log exists (creates from schema if missing)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/daily-init.py"
