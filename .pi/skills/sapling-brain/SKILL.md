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

## First-Class Wiki Pages

Use these folders for durable business pages:

- `brain/wiki/people/`
- `brain/wiki/companies/`
- `brain/wiki/clients/`
- `brain/wiki/opportunities/`
- `brain/wiki/engagements/`
- `brain/wiki/projects/`
- `brain/wiki/offers/`
- `brain/wiki/commitments/`
- `brain/wiki/decisions/`
- `brain/wiki/case-studies/`
- `brain/wiki/content/`
- `brain/wiki/operating-model/`

## PR Review Workflow

When reviewing or tracking a PR from any repo:

1. Save raw PR context to `brain/raw/github/{owner-repo}/prs/{number}.md`.
2. Add the active review item to `brain/ops/pr-queue.md`.
3. Update `brain/wiki/projects/{project}.md` with durable project context.
4. Save review output to `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`.
5. Save lasting technical or business decisions in `brain/wiki/decisions/`.

Do not merge unrelated project code into Sapling just to make it reviewable.

## Migration Workflow

When migrating old HarryOS or legacy Sapling content:

1. Import original material into `brain/raw/imports/` or the closest raw source folder.
2. Create or update matching wiki pages.
3. Move active open loops into `brain/ops/commitments.md`, `brain/ops/inbox.md`, or `brain/ops/pr-queue.md`.
4. Preserve old paths only as temporary references.
5. Use schemas before inventing new frontmatter.

## Search Order

1. `AGENTS.md` for the operating contract.
2. `brain/wiki/` for durable memory.
3. `brain/ops/` for active state.
4. `brain/raw/` for source evidence.
5. `brain/outputs/` for prior deliverables.
6. Legacy folders only when migrating or resolving old links.
