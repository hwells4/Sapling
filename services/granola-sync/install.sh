#!/bin/bash
#
# Install Granola Sync daemon
# Watches for Granola cache changes and syncs meeting notes to your vault
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.sapling.granola-sync.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
GRANOLA_CACHE="$HOME/Library/Application Support/Granola/cache-v3.json"

echo "Granola Sync Installer"
echo "======================"
echo

# Check if Granola is installed
if [ ! -f "$GRANOLA_CACHE" ]; then
    echo "Warning: Granola cache not found at:"
    echo "  $GRANOLA_CACHE"
    echo
    echo "Granola may not be installed, or hasn't been used yet."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 1
    fi
fi

# Check Python dependencies
echo "Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found. Please install Python 3."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Creating .env from .env.example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Create launchd plist
echo "Creating launchd plist..."
cat > "$LAUNCH_AGENTS_DIR/$PLIST_NAME" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sapling.granola-sync</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$SCRIPT_DIR/sync.py</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>

    <key>WatchPaths</key>
    <array>
        <string>$GRANOLA_CACHE</string>
    </array>

    <key>ThrottleInterval</key>
    <integer>60</integer>

    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/logs/sync.log</string>

    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/logs/sync.error.log</string>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

# Load the daemon
echo "Loading daemon..."
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo
echo "Installation complete!"
echo
echo "The daemon will run automatically when Granola writes meeting notes."
echo "Logs are saved to: $SCRIPT_DIR/logs/"
echo
echo "To check status: launchctl list | grep granola"
echo "To uninstall: ./uninstall.sh"
