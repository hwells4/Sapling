# Granola Sync

Automatically sync [Granola](https://granola.ai) meeting notes to your vault.

## What it does

- Watches Granola's local cache for new meetings
- Extracts AI-generated summaries, attendees, meeting links, and metadata
- Saves as markdown files with frontmatter to `brain/calls/`
- Runs automatically via macOS launchd

## Requirements

- macOS
- Python 3
- Granola installed and used at least once

## Installation

```bash
cd services/granola-sync
chmod +x install.sh uninstall.sh
./install.sh
```

The daemon starts automatically when Granola writes to its cache file.

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Path to save call notes (defaults to brain/calls/)
OUTPUT_PATH=/path/to/your/vault/brain/calls

# Delay before syncing (seconds, default 60)
# Gives Granola time to generate AI notes
SYNC_DELAY=60
```

## Usage

Once installed, the daemon runs automatically. No manual action needed.

**Check status:**
```bash
launchctl list | grep granola
```

**View logs:**
```bash
tail -f logs/sync.log
```

**Manual sync:**
```bash
python3 sync.py
```

## Uninstall

```bash
./uninstall.sh
```

## How it works

1. Granola stores meeting data in `~/Library/Application Support/Granola/cache-v3.json`
2. launchd watches this file for changes
3. When changed, `sync.py` runs after a 60-second delay (configurable)
4. New meetings are saved as markdown to your vault
5. Already-synced meetings are skipped (tracked by `granola_id` in frontmatter)

## Output format

Each meeting is saved as:

```markdown
---
schema_version: 1.0.0
date: 2026-01-20
type: call
granola_id: abc123-...
source: granola
people: []
companies: []
tags:
  - date/2026-01-20
  - call
---

# Meeting Title

**Date:** January 20, 2026
**Attendees:** Alice, Bob
**Duration:** 30 minutes
**Meeting Link:** https://meet.google.com/...

---

## Notes

[AI-generated meeting summary from Granola]

---
*Synced from Granola*
```

## Privacy

- Runs entirely locally
- No data sent to external services
- Transcripts are NOT synced (only AI summaries)
