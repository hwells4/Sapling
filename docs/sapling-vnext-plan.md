# Sapling vNext Plan

## Goal

Make Sapling a generalized, wiki-centered business operating system that works across Claude, Codex, Pi, and future agents without copying project code into the brain.

## Pattern Borrowed From Compound Engineering

Compound Engineering's useful pattern is not a single giant instructions file. It uses:

- One canonical source of truth.
- Platform-specific shims for each agent.
- Tests or checks to catch drift between generated or copied surfaces.

Sapling uses the lightweight version:

- `AGENTS.md` is canonical.
- `CLAUDE.md`, `.agents/skills/sapling-brain`, and `.pi/skills/sapling-brain` are shims.
- `scripts/check-agent-surface-parity.py` checks that the shared Sapling skill is identical across Claude, Codex, and Pi.
- `.codex/hooks.json` reuses the Claude hook router instead of duplicating hook logic.

## Brain Contract

```text
brain/raw/      # source material and imports
brain/wiki/     # durable business memory
brain/ops/      # active operating cockpit
brain/outputs/  # finished deliverables
```

`schemas/` remains at the repo root because it is an agent/tooling contract, not business memory.

## What Goes In Each Layer

`brain/raw/`:

- Calls and transcripts
- Email exports
- GitHub PR payloads and review context
- Imported HarryOS material
- Web clips and research source material

`brain/wiki/`:

- People
- Companies
- Clients
- Opportunities
- Engagements
- Projects
- Offers
- Commitments
- Decisions
- Case studies
- Content ideas and durable content memory
- Operating model pages such as about-me, business, preferences, and voice

`brain/ops/`:

- Daily and weekly logs
- Inbox and triage
- Commitments
- PR queue
- Active review loops
- Short-lived coordination state

`brain/outputs/`:

- PR reviews
- PRDs
- Client emails
- Proposals
- Strategy memos
- Research summaries
- Content drafts meant to become artifacts

## PR Review Flow

Do not merge source code repos into Sapling. Import context:

1. Save raw PR context in `brain/raw/github/{owner-repo}/prs/{number}.md`.
2. Track active review state in `brain/ops/pr-queue.md`.
3. Update durable project memory in `brain/wiki/projects/{project}.md`.
4. Save the review artifact in `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`.
5. Promote lasting decisions into `brain/wiki/decisions/`.

## HarryOS Migration Sequence

1. Freeze a clean Sapling vNext instance.
2. Import HarryOS files into `brain/raw/imports/harryos/` first.
3. Promote business-critical context into wiki pages.
4. Move active work into `brain/ops/inbox.md`, `brain/ops/commitments.md`, and `brain/ops/pr-queue.md`.
5. Recreate durable deliverables under `brain/outputs/` only when they are useful going forward.
6. Leave legacy paths readable during the migration, but do not create new work there.

## Guardrails

- New durable business facts belong in `brain/wiki/`.
- Source evidence belongs in `brain/raw/`.
- Active queues belong in `brain/ops/`.
- Finished artifacts belong in `brain/outputs/`.
- Beads owns tasks and dependencies.
- Agents should update wiki context when PRs, calls, or outputs change the durable understanding of a project.
