# SaplingOS

A personal operating system built on Claude Code that learns your preferences over time.

**Core idea:** Run `/task` to work with decision tracing. Run `/calibrate` to review decisions and improve the system. The more you use it, the smarter it gets.

## Quick Start

**Prerequisites:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Beads](https://github.com/steveyegge/beads), Python 3.8+

**Optional:** [fzf](https://github.com/junegunn/fzf) - enables fuzzy file matching in Claude Code (`brew install fzf`)

```bash
# Install beads
brew tap steveyegge/beads && brew install bd

# Clone and setup
git clone https://github.com/hwells4/SaplingOS.git
cd SaplingOS
bd onboard

# Start using it
claude
/onboard  # First-time setup (~5 min)
```

## What You Get

- **`/task`** - Start work with automatic decision tracing
- **`/calibrate`** - Review your decisions and improve the system over time
- **Structured vault** - Obsidian-compatible knowledge base with queryable schemas
- **Beads integration** - File-based issue tracking that syncs with git

## Commands

| Command | Description |
|---------|-------------|
| `/task` | Start a task with decision tracing |
| `/calibrate` | Review decision traces and improve skills |
| `/onboard` | Initial setup - populate context |
| `/today` | Create/open today's daily note |
| `/commit` | Git commit with Linear issue sync |
| `/push` | Push to remote |

## Directory Structure

```
SaplingOS/
├── CLAUDE.md           # System instructions for Claude Code
├── brain/              # Your knowledge base
│   ├── context/        # About you, your business, your voice
│   ├── entities/       # People and companies
│   ├── outputs/        # Deliverables (posts, PRDs, emails)
│   └── traces/         # Decision traces for calibration
├── schemas/            # YAML schemas for file structure
└── .claude/            # Commands, skills, and hooks
```

## Optional Services

### Call Recording with Granola

If you use [Granola](https://granola.ai) for meeting notes, SaplingOS can automatically sync them to your vault:

```bash
cd services/granola-sync
./install.sh
```

Meeting summaries sync to `brain/calls/` whenever Granola records a call. The `/onboard` command will offer to set this up if Granola is detected.

## Configuration

Copy `.env.example` to `.env` for optional features:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Image generation via `/generate-visuals` |
| `GITHUB_TOKEN` | GitHub CLI auth (if not using `gh auth login`) |

## License

MIT License - see [LICENSE](LICENSE)

---

Built on [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Obsidian](https://obsidian.md), and [Beads](https://github.com/steveyegge/beads).
