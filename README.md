# SaplingOS

A context engineering system for Claude Code + Obsidian that evolves to your preferences over time.

SaplingOS operates your personal knowledge base, executes tasks with minimal context pollution, and captures decisions that feed back into skill improvements. Each interaction helps the system learn and improve itself.

## What You Get

- **Queryable vault structure** - Schemas ensure files are grep-able and searchable
- **Pre-built commands** - `/task`, `/today`, `/onboard`, `/commit`, and more
- **Skills** - Reusable workflows for PRDs, email drafts, content ideation
- **Decision tracing** - Captures meaningful choices to calibrate the system

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI)
- [Beads](https://github.com/steveyegge/beads) - Issue tracking for agents
- [Obsidian](https://obsidian.md) (optional but recommended for viewing)
- Python 3.8+ with `pyyaml` (`pip install pyyaml`)

### Installing Beads

```bash
brew tap steveyegge/beads
brew install bd
```

Or see [Beads installation docs](https://github.com/steveyegge/beads#installation) for other methods.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/hwells4/SaplingOS.git
cd SaplingOS

# 2. Initialize beads
bd onboard

# 3. Set up environment (optional - for image generation skill)
cp .env.example .env
# Edit .env with your API keys

# 4. Open with Claude Code
claude

# 5. Run onboarding
/onboard
```

The onboarding process takes ~5 minutes and:
1. Asks for your website (personal or business) to extract context
2. Asks follow-up questions to personalize the system
3. Populates your `brain/context/` files

## Directory Structure

```
SaplingOS/
├── CLAUDE.md           # Main system instructions (read by Claude Code)
├── brain/              # Your personal knowledge base
│   ├── calls/          # Call notes and transcripts
│   ├── context/        # About you, your business, your voice
│   ├── entities/       # People and companies
│   ├── inbox/          # Tasks pending action
│   ├── library/        # Reference materials
│   ├── notes/          # Daily and weekly notes
│   ├── outputs/        # Deliverables (posts, PRDs, emails)
│   └── traces/         # Decision traces for calibration
├── schemas/            # YAML schemas that define file structure
│   ├── vault/          # Schema definitions (entity, call, etc.)
│   └── migrations/     # Schema version migrations
├── .claude/            # Claude Code configuration
│   ├── commands/       # Slash commands (/task, /commit, etc.)
│   ├── skills/         # Reusable workflows
│   └── hooks/          # Event handlers
└── scripts/            # Automation scripts
    └── loop/           # AFK coding loop agent
```

## Commands

| Command | Description |
|---------|-------------|
| `/onboard` | Initial setup - populate context, choose creature |
| `/task <description>` | Start a task with planning and decision tracing |
| `/today` | Create/open today's daily note |
| `/commit` | Git commit with Linear issue sync |
| `/push` | Push to remote |
| `/migrate` | Run schema migrations on vault files |
| `/calibrate` | Review decision traces and improve skills |
| `/triage` | Process inbox items needing decisions |

## How Schemas Work

Every file type has a YAML schema in `schemas/vault/`. Schemas define:
- Required/optional frontmatter fields
- Tag patterns for queryability
- Body section structure

This makes files consistently grep-able:

```bash
# Find all content for a person
grep -r "person/john-doe" brain/

# Find all call notes with a company
grep -r "company/acme" brain/calls/

# Find all draft outputs
grep -r "status/draft" brain/outputs/
```

## Skills

Skills are reusable workflows in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| `onboard` | New user setup |
| `today` | Daily note creation |
| `decision-traces` | Extract decisions from completed work |
| `calibration-workflow` | Review traces, improve system |
| `generate-prd` | PRD creation through questioning |
| `generate-stories` | Break PRDs into executable stories |
| `agent-chatroom` | Multi-agent coordination |

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and add your keys:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | For image gen | Powers the nano-banana-pro skill |
| `GITHUB_TOKEN` | Optional | GitHub CLI auth (if not using `gh auth login`) |

### Claude Code Settings

Claude Code reads `CLAUDE.md` at the root for system instructions. Key sections:
- `<querying>` - How to find things in the vault
- `<context_engineering>` - Token budget management
- `<behaviors>` - System behavior rules

### Hooks

Hooks in `.claude/hooks/` run on events:
- `session-init.sh` - Sets up environment on session start
- `daily-init.py` - Ensures daily note exists
- `validate-edits.py` - Validates schema compliance on file edits

### Optional Features

| Feature | Requires | Purpose |
|---------|----------|---------|
| Image generation | `GEMINI_API_KEY` | Generate images via `/generate-visuals` skill |
| GitHub integration | `gh` CLI | Create repos, PRs via `/github` skill |

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Run tests (if applicable)
5. Submit a PR

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

Built on:
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic
- [Obsidian](https://obsidian.md) for knowledge management
- [Beads](https://github.com/steveyegge/beads) for agent issue tracking
