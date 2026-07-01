# SaplingOS

SaplingOS is an agent-agnostic business brain for Claude, Codex, Pi, and local tools. It keeps raw source material, curated wiki pages, operating queues, and durable outputs in predictable places so agents can help run the business without dragging stale context through every session.

The core pattern is:

1. Capture source material in `brain/raw/`.
2. Distill durable knowledge into `brain/wiki/`.
3. Run active work from `brain/ops/`.
4. Save finished deliverables in `brain/outputs/`.

`schemas/` and hooks enforce that structure. Beads tracks work that needs state across sessions.

## Quick Start

Required: Python 3.8+. Claude Code gets the fullest hook integration today; Codex and Pi use the same repo contract plus lightweight compatibility shims.

```bash
git clone https://github.com/hwells4/Sapling.git
cd Sapling
```

In Claude Code:

```text
/onboard
```

In Codex or Pi, read `AGENTS.md` first, then run the same workflows through chat or the repo-scoped `sapling-brain` skill.

## Brain Structure

```text
Sapling/
|-- brain/
|   |-- raw/              # Ingested source material: calls, email, PRs, web clips, transcripts
|   |-- wiki/             # First-class business pages: clients, projects, offers, decisions
|   |-- ops/              # Operating cockpit: daily logs, weekly reviews, commitments, PR queue
|   `-- outputs/          # Durable deliverables: PRDs, posts, emails, reports, reviews
|-- schemas/
|   |-- vault/            # File schemas for brain/ content
|   `-- tags/             # Shared tag taxonomy
|-- .claude/              # Claude commands, hooks, and skills
|-- .agents/              # Codex-compatible repo skills
`-- .pi/                  # Pi-compatible repo skills and notes
```

### `brain/raw/`

Raw is append-only source context. Put meeting notes, transcripts, email exports, GitHub PR summaries, research clippings, and imported HarryOS material here. Agents should not polish raw notes in place; they should link from wiki pages back to raw sources.

### `brain/wiki/`

Wiki is the operating memory. This is where first-class business pages live:

- `brain/wiki/clients/`
- `brain/wiki/projects/`
- `brain/wiki/engagements/`
- `brain/wiki/opportunities/`
- `brain/wiki/offers/`
- `brain/wiki/people/`
- `brain/wiki/companies/`
- `brain/wiki/commitments/`
- `brain/wiki/decisions/`
- `brain/wiki/operating-model/`

If a concept should survive beyond one session, it belongs in the wiki.

### `brain/ops/`

Ops is the working cockpit, not the knowledge base. It holds daily logs, weekly reviews, active commitments, triage queues, and PR review queues. Ops pages point into the wiki and outputs.

### `brain/outputs/`

Outputs are finished artifacts created for a user or external audience. Examples: PRDs, client emails, proposals, PR reviews, strategy memos, LinkedIn posts, scripts, and migration plans.

## GitHub PR Context

Do not merge unrelated project code into Sapling. Instead, ingest PR context:

- Raw PR material: `brain/raw/github/{owner-repo}/prs/{number}.md`
- Active queue: `brain/ops/pr-queue.md`
- Project memory: `brain/wiki/projects/{project}.md`
- Review deliverables: `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`

This gives agents one place to review cross-project work, update project context, and preserve decisions without turning Sapling into a monorepo.

## Agent Compatibility

Sapling uses a canonical contract plus platform shims:

- `AGENTS.md` is the primary cross-agent instruction file.
- `CLAUDE.md` is a Claude compatibility shim that points back to `AGENTS.md`.
- `.claude/` contains Claude commands, hooks, and legacy skills.
- `.agents/skills/sapling-brain/` exposes the core workflow to Codex-style skill discovery.
- `.pi/skills/sapling-brain/` exposes the same workflow to Pi.

The parity check keeps the shared skill content aligned:

```bash
python3 scripts/check-agent-surface-parity.py
```

## Hooks

Hooks are the strongest integration point in Claude Code. The recommended profile enables schema checks, prose checks, skill routing, daily log setup, session logging, and optional git automation.

```bash
python3 .claude/hooks/setup-local-hooks.py
```

To keep the core hooks but disable git auto-commit/push:

```bash
python3 .claude/hooks/setup-local-hooks.py --profile no-git
```

Codex can use `.codex/hooks.json` where supported. Pi currently uses the repo instructions and skill shim, with manual workflow execution if hook support is unavailable.

## Useful Commands

| Command | Description |
|---------|-------------|
| `/onboard` | First-run setup |
| `/today` | Create or open today's ops daily log |
| `/task` | Start tracked work |
| `/create-skill` | Create or modify skills |
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
