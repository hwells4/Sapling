---
name: sapling-vault
description: Work safely with the SaplingOS Obsidian-style vault. Use when creating or editing brain/ content, durable outputs, daily logs, entities, call notes, library notes, or tag/schema-backed files.
---

# Sapling vault operations

Use this skill for repository-local knowledge work.

## Read first

- `CLAUDE.md` for vault structure and conventions.
- The relevant schema in `schemas/vault/` before creating structured vault files.
- `schemas/tags/taxonomy.yaml` before adding tags.

## Durable outputs

If the user asks for a durable artifact, write it to `brain/outputs/YYYY-MM-DD-{slug}.md` with output frontmatter:

```yaml
---
schema_version: 1.1.0
date: YYYY-MM-DD
type: research
status: draft
tags:
  - date/YYYY-MM-DD
  - output
  - output/research
  - status/draft
---
```

If the user did not ask to save an artifact, answer in chat.

## Vault locations

- `brain/entities/`: people and companies.
- `brain/calls/`: call notes.
- `brain/outputs/`: deliverables.
- `brain/logs/`: daily and weekly operating logs.
- `brain/library/`: reference material and retrospectives.
- `brain/context/`: identity, business, voice, and preferences.

## Safety

Do not write secrets into the vault. Do not create arbitrary new folders for drafts or generated reports.
