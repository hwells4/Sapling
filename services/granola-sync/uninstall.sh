#!/bin/bash
#
# Uninstall Granola Sync daemon
#

set -e

PLIST_NAME="com.sapling.granola-sync.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "Granola Sync Uninstaller"
echo "========================"
echo

# Unload and remove the daemon
if [ -f "$LAUNCH_AGENTS_DIR/$PLIST_NAME" ]; then
    echo "Stopping daemon..."
    launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true

    echo "Removing plist..."
    rm "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

    echo
    echo "Uninstall complete!"
else
    echo "Daemon not installed (plist not found)."
fi

echo
echo "Note: Your synced call notes have not been deleted."
echo "Note: Logs in ./logs/ have not been deleted."
