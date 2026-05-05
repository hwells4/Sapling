# SaplingOS

A personal operating system for Claude Code: local knowledge, hooks, and durable outputs.

Run `/onboard` first. It checks the local repo, reads project docs like `README.md`, `AGENTS.md`, and `CLAUDE.md`, configures hooks, and creates your starting context.

## Quick Start

*Required: Claude Code, Python 3.8+, and Homebrew on macOS for the Beads install command below.*

### 1. Clone And Set Up

```bash
git clone https://github.com/hwells4/Sapling.git
cd Sapling

brew tap steveyegge/beads && brew install bd
bd onboard
```

### 2. Run Onboarding

```bash
claude
/onboard
```

## What Onboarding Does

- Checks required tools and local project docs
- Creates or updates `brain/context/`
- Installs the recommended local hook profile
- Explains the core workflows: `/today`, `/task`, beads, and durable outputs

## Hooks

Hooks are the core of Sapling. The recommended profile enables schema/prose checks, skill routing, session logging, daily-note setup, memory when supported, and git auto-commit/push.

```bash
python3 .claude/hooks/setup-local-hooks.py
```

To keep the core hooks but disable git auto-commit/push:

```bash
python3 .claude/hooks/setup-local-hooks.py --profile no-git
```

Hook authoring lives in the maintained `create-hooks` plugin:

```bash
/plugin install github:hwells4/create-hooks
/create-hooks:create-hook
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `/onboard` | First-run setup |
| `/today` | Create or open today's daily note |
| `/task` | Start tracked work |
| `/create-skill` | Create or modify Claude Code skills |
| `/ideate` | Generate and winnow improvement ideas |
| `/refine` | Iteratively refine plans or beads |
| `/commit` | Create an atomic git commit |
| `/push` | Push to remote |

## Configuration

Optional environment variables can go in `.env` or `.env.local`.

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Image generation via `/generate-visuals` |
| `GITHUB_TOKEN` | GitHub CLI auth if `gh auth login` is not configured |

## License

MIT License - see [LICENSE](LICENSE).
