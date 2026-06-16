# SaplingOS repository instructions for Pi

This repository is a personal knowledge system built around `brain/`, schemas, Beads task tracking, and reusable agent workflows.

## Core conventions

- Use `AGENTS.md` and `CLAUDE.md` as the source of truth for repository behavior.
- Keep durable user-facing artifacts in `brain/outputs/YYYY-MM-DD-{slug}.md` with the output schema frontmatter.
- Keep knowledge in the vault structure:
  - `brain/entities/` for people and companies.
  - `brain/calls/` for call notes.
  - `brain/outputs/` for deliverables.
  - `brain/logs/` for daily/weekly operating logs.
  - `brain/library/` for reference material.
  - `brain/context/` for personal/business/voice/preferences context.
- Use existing tags from `schemas/tags/taxonomy.yaml` before creating new tags.
- Beads (`bd`) is the durable task tracker when available. Use it for multi-step or cross-session work.
- Prefer simple solutions. Add new infrastructure only after simpler approaches fail in actual use.

## Safety and output policy

- Do not scatter generated plans, research notes, or drafts into random folders.
- Do not commit secrets. Treat `.env`, `.env.local`, credentials, tokens, private keys, and generated local hook settings as private.
- The legacy Claude hooks include git automation, vault validation, skill routing, session logging, and memory behavior. Do not replicate destructive or auto-commit behavior in Pi without explicit user approval.
- When ending a substantial coding session, run the relevant checks, commit work, pull/rebase, sync Beads if available, push to the remote, and verify the branch is up to date.
