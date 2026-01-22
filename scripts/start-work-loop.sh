#!/bin/bash
# Start Sapling MVP work loop
# Triggered by cron when usage resets

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIPELINES_DIR="$HOME/Projects/agent-pipelines"
LOG_FILE="$PROJECT_DIR/logs/work-loop-$(date +%Y%m%d-%H%M%S).log"

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

echo "=== Sapling MVP Work Loop ===" | tee "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "Project: $PROJECT_DIR" | tee -a "$LOG_FILE"

# Change to project directory - this is where skills live
cd "$PROJECT_DIR"

# Check beads are ready
echo "Ready beads:" | tee -a "$LOG_FILE"
bd ready 2>&1 | tee -a "$LOG_FILE"

# Start the work loop
# IMPORTANT: Set PROJECT_ROOT to Sapling so Claude picks up .claude/skills/
echo "" | tee -a "$LOG_FILE"
echo "Starting ralph work loop..." | tee -a "$LOG_FILE"
echo "PROJECT_ROOT: $PROJECT_DIR (skills will load from .claude/skills/)" | tee -a "$LOG_FILE"

export PROJECT_ROOT="$PROJECT_DIR"
"$PIPELINES_DIR/scripts/run.sh" ralph sapling-mvp 25 \
  --input="$PROJECT_DIR/sapling.md" \
  --context="WORKING DIRECTORY: $PROJECT_DIR

Skills available in .claude/skills/:
- react-best-practices (40+ rules for React/Next.js)
- ui-skills (Tailwind, Base UI, accessibility)

Invoke /react-best-practices and /ui-skills before implementing UI components.

Focus on P1 beads first. Use bd to claim and close beads." 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Work loop started in tmux. Attach with: tmux attach -t pipeline-sapling-mvp" | tee -a "$LOG_FILE"
