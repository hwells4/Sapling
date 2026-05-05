# SaplingOS

A personal operating system for Claude Code: local knowledge, hooks, and durable outputs.

Run `/onboard` first. It checks the local repo, reads project docs like `README.md`, `AGENTS.md`, and `CLAUDE.md`, configures hooks, and creates your starting context.

## Quick Start

*Required: Claude Code and Python 3.8+. Onboarding checks Beads and can help install or initialize it.*

### 1. Clone Sapling

```bash
git clone https://github.com/hwells4/Sapling.git
cd Sapling
```

### 2. Open Claude Code

```bash
claude
```

### 3. Run Onboarding

```text
/onboard
```

## What Onboarding Does

- Checks required tools and local project docs
- Installs or initializes Beads when needed, with your approval
- Creates or updates `brain/context/`
- Installs the recommended local hook profile
- Explains the core workflows: `/today`, `/task`, beads, and durable outputs

## Structure

Sapling keeps personal knowledge in `brain/` and validates durable files with schemas in `schemas/`.

```text
Sapling/
├── brain/
│   ├── calls/            # Call notes and meeting records
│   ├── context/          # Personal context: identity, business, voice, preferences
│   ├── entities/         # People and companies
│   ├── library/          # Reference material and retrospectives
│   ├── logs/             # Activity tracking for automations, summaries, and review
│   └── outputs/          # Durable deliverables: posts, PRDs, emails, reports
├── schemas/
│   ├── vault/            # File schemas for brain/ content
│   └── tags/             # Shared tag taxonomy
└── .claude/
    ├── commands/         # Slash commands
    ├── hooks/            # Local automation and validation hooks
    └── skills/           # Reusable workflows
```

## Hooks

Hooks are the core of Sapling. The recommended profile enables schema/prose checks, skill routing, session logging, daily log setup, memory when supported, and git auto-commit/push.

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
| `/today` | Create or open today's daily log |
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
