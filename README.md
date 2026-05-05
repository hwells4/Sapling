# SaplingOS

A personal operating system built on Claude Code for local knowledge, hooks, and durable outputs.

**Core idea:** Run `/onboard` first, then use Sapling as a lightweight personal knowledge base that Claude Code can read and improve with you over time.

## Quick Start

**Prerequisites:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Beads](https://github.com/steveyegge/beads), Python 3.8+

**Optional:** [fzf](https://github.com/junegunn/fzf) - enables fuzzy file matching in Claude Code (`brew install fzf`)

```bash
# Install beads
brew tap steveyegge/beads && brew install bd

# Clone and setup
git clone https://github.com/hwells4/Sapling.git
cd Sapling

# Prime agent workflow instructions
bd onboard

# Start using Sapling
claude
/onboard  # First-time setup, including optional local hooks
```

## What You Get

- **`/onboard`** - First-run setup for context files and local hooks
- **`/today`** - Create or open today's daily note
- **Structured vault** - Obsidian-compatible knowledge base with a PARA-inspired direction
- **Beads integration** - File-based issue tracking that syncs with git

## Commands

| Command | Description |
|---------|-------------|
| `/onboard` | Initial setup - populate context |
| `/today` | Create/open today's daily note |
| `/task` | Start tracked work |
| `/create-skill` | Create or modify Claude Code skills |
| `/ideate` | Generate and winnow improvement ideas |
| `/refine` | Iteratively refine plans or beads |
| `/commit` | Create an atomic git commit |
| `/push` | Push to remote |

## Directory Structure

```
SaplingOS/
├── CLAUDE.md           # System instructions for Claude Code
├── brain/              # Your knowledge base
│   ├── context/        # About you, your business, your voice
│   ├── entities/       # People and companies
│   ├── outputs/        # Deliverables (posts, PRDs, emails)
│   └── notes/          # Daily/weekly/monthly notes
├── schemas/            # YAML schemas for file structure
└── .claude/            # Commands, skills, and hooks
```

## Local Hooks

Hooks are integral to Sapling. The repo registers the core hook router, and onboarding writes a local profile so hooks can adapt to the user's machine.

Hook authoring comes from the maintained `create-hooks` plugin, not from a vendored Sapling skill:

```bash
/plugin install github:hwells4/create-hooks
```

Use `/create-hooks:create-hook` to create, edit, analyze, or debug hooks.

Run `/onboard` to choose a hook profile, or run the setup script directly:

```bash
python3 .claude/hooks/setup-local-hooks.py --profile recommended
```

Profiles:

| Profile | Use When | Includes |
|---------|----------|----------|
| `minimal` | You want the safest setup | Daily-note session hook only |
| `recommended` | Default for most users | Daily note, schema/prose checks, skill routing when supported |
| `full` | You explicitly want automation | Recommended hooks plus git auto-commit/push |

The script writes `.claude/settings.local.json`, which is ignored by git. Unsupported optional hooks disable themselves instead of failing the session.

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
