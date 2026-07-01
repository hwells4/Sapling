# Sapling Agent Contract

Sapling is a wiki-centered business operating system. These instructions are the canonical contract for Claude, Codex, Pi, and any other agent working in this repo.

## Operating Model

Use the brain in four layers:

```text
brain/raw/      # source material, imports, transcripts, emails, PR payloads
brain/wiki/     # LLM-maintained durable markdown wiki
brain/ops/      # active operating cockpit, queues, reviews, daily logs
brain/outputs/  # finished deliverables and generated artifacts
```

`schemas/` remains outside `brain/` as the repo-level validation contract. Beads remains the task system.

## Source Of Truth

- `brain/raw/` owns evidence and imported context. Keep it close to the source and avoid rewriting it into polished memory.
- `brain/wiki/` owns durable business context. If something matters after today, create or update the relevant wiki page.
- `brain/ops/` owns current execution state: daily logs, weekly reviews, commitments, inboxes, PR queue, triage.
- `brain/outputs/` owns deliverables. Save durable work here with output schema frontmatter.
- `.beads/` owns tasks, dependencies, and multi-session work state.

## Wiki Pages

Use these as starter wiki areas, not as a closed ontology:

- `brain/wiki/people/`
- `brain/wiki/companies/`
- `brain/wiki/clients/`
- `brain/wiki/projects/`
- `brain/wiki/topics/`
- `brain/wiki/decisions/`
- `brain/wiki/operating-model/`

Create pages as the wiki needs them. New page types and folders are allowed when a recurring concept, entity, object, or relationship becomes useful to link from elsewhere. Do not predefine every topic up front.

Every ingest should update `brain/wiki/index.md` and append to `brain/wiki/log.md`.

## Ingest Workflow

When adding a raw source:

1. Save the original source in `brain/raw/`.
2. Read `brain/wiki/index.md` to find relevant existing pages.
3. Update existing wiki pages or create new pages only where useful.
4. Link wiki claims back to raw evidence with `source_refs`.
5. Update `brain/wiki/index.md` with new or materially changed pages.
6. Append a short entry to `brain/wiki/log.md`.

## Ops Pages

Use `brain/ops/` for things the business is actively running:

- `brain/ops/daily/YYYY-MM-DD.md`
- `brain/ops/weekly/YYYY-Www.md`
- `brain/ops/inbox.md`
- `brain/ops/commitments.md`
- `brain/ops/pr-queue.md`

Ops pages should be short, current, and link-heavy. Do not bury durable facts in ops pages only; promote them into `brain/wiki/`.

## GitHub PR Workflow

When asked to review or track PRs from any project, do not merge project code into Sapling. Ingest context instead:

1. Save raw PR context in `brain/raw/github/{owner-repo}/prs/{number}.md`.
2. Add or update the active item in `brain/ops/pr-queue.md`.
3. Update the relevant project page in `brain/wiki/projects/{project}.md`.
4. Save the review artifact in `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`.
5. Capture lasting decisions in `brain/wiki/decisions/` when needed.
6. Update `brain/wiki/index.md` and append to `brain/wiki/log.md`.

## Output Policy

When an agent creates a durable artifact, save it under `brain/outputs/YYYY-MM-DD-{slug}.md` or a typed subfolder such as `brain/outputs/pr-reviews/`, with output schema frontmatter.

If the user did not ask for something to be saved, keep it in chat. Do not create generated drafts, plans, reports, or research notes in arbitrary folders.

## Beads

This project uses **bd** for issue tracking. User setup happens through `/onboard`; agents can run `bd onboard` only when they need the latest Beads instruction snippet.

```bash
bd ready
bd show <id>
bd update <id> --status in_progress
bd close <id>
bd sync
```

Use beads for multi-step work, discovered follow-ups, blocked work, dependencies, or anything likely to span sessions. Keep ephemeral checklist state in the current agent UI only.

## Agent Compatibility

- Claude should read `CLAUDE.md`, then follow this file as canonical.
- Codex should follow this file and may use `.agents/skills/sapling-brain/SKILL.md`.
- Pi should follow this file and may use `.pi/skills/sapling-brain/SKILL.md`.
- Do not create divergent platform-specific behavior unless a platform cannot support the shared contract.

When updating the shared Sapling workflow, keep these files aligned:

- `.claude/skills/sapling-brain/SKILL.md`
- `.agents/skills/sapling-brain/SKILL.md`
- `.pi/skills/sapling-brain/SKILL.md`

Run:

```bash
python3 scripts/check-agent-surface-parity.py
```

## Session Start

At the start of substantial work:

1. Run `git status -sb`.
2. Check relevant beads with `bd ready` and `bd list --status=in_progress` when available.
3. Read today's daily note if it exists at `brain/ops/daily/YYYY-MM-DD.md`.
4. State the immediate actions and begin.

## Session Completion

When ending a work session, capture:

- What changed
- What remains
- Git state
- Beads state
- Next steps
- Risks or gotchas

If the user asked you to commit or ship, complete the normal git workflow. Never use destructive git commands without explicit user instruction.
