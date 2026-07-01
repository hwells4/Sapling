---
name: sapling-brain
description: Operate Sapling's wiki-centered business brain across Claude, Codex, and Pi. Use when creating or migrating brain files, reviewing PR context, updating project context, or deciding where information belongs.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Sapling Brain

Use this skill to keep Sapling organized around the canonical brain contract in `AGENTS.md`.

## Core Structure

```text
brain/raw/      # source material and imports
brain/wiki/     # durable business memory
brain/ops/      # active operating cockpit
brain/outputs/  # finished deliverables
```

`schemas/` is the validation contract. Beads is the task system.

## Placement Rules

- Put evidence, imports, transcripts, email exports, GitHub PR summaries, and web clips in `brain/raw/`.
- Put durable business context in `brain/wiki/`.
- Put active queues, daily logs, weekly reviews, commitments, and triage in `brain/ops/`.
- Put deliverables in `brain/outputs/`.
- If source material creates a durable fact, update the wiki page and link back to the raw source with `source_refs`.
- If an ops page contains a fact that should matter next month, promote it into `brain/wiki/`.
- Keep `brain/wiki/index.md` as the content catalog and `brain/wiki/log.md` as the chronological audit trail.

## Wiki Pages

Use these as starter wiki areas, not as a closed ontology:

- `brain/wiki/people/`
- `brain/wiki/companies/`
- `brain/wiki/clients/`
- `brain/wiki/projects/`
- `brain/wiki/topics/`
- `brain/wiki/decisions/`
- `brain/wiki/operating-model/`

Create pages as needed. A new page is appropriate when a source introduces a distinct entity, project, decision, topic, or concept that should be linked from elsewhere. Do not predefine every topic.

## Ingest Workflow

When ingesting a source:

1. Save the original source in `brain/raw/`.
2. Read `brain/wiki/index.md`.
3. Update existing wiki pages where the source changes the durable understanding.
4. Create new pages only when they will be useful to link from elsewhere.
5. Add `source_refs` back to the raw source.
6. Update `brain/wiki/index.md`.
7. Append a short entry to `brain/wiki/log.md`.

## PR Review Workflow

When reviewing or tracking a PR from any repo:

1. Save raw PR context to `brain/raw/github/{owner-repo}/prs/{number}.md`.
2. Add the active review item to `brain/ops/pr-queue.md`.
3. Update `brain/wiki/projects/{project}.md` with durable project context.
4. Save review output to `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`.
5. Save lasting technical or business decisions in `brain/wiki/decisions/`.
6. Update `brain/wiki/index.md` and append to `brain/wiki/log.md`.

Do not merge unrelated project code into Sapling just to make it reviewable.

## Migration Workflow

When migrating old HarryOS or legacy Sapling content:

1. Import original material into `brain/raw/imports/` or the closest raw source folder.
2. Create or update matching wiki pages.
3. Create emergent topic pages in `brain/wiki/topics/` only when useful.
4. Move active open loops into `brain/ops/commitments.md`, `brain/ops/inbox.md`, or `brain/ops/pr-queue.md`.
5. Update `brain/wiki/index.md` and append to `brain/wiki/log.md`.
6. Preserve old paths only as temporary references.
7. Use schemas before inventing new frontmatter.

## Search Order

1. `AGENTS.md` for the operating contract.
2. `brain/wiki/` for durable memory.
3. `brain/ops/` for active state.
4. `brain/raw/` for source evidence.
5. `brain/outputs/` for prior deliverables.
6. Legacy folders only when migrating or resolving old links.
