---
name: obsidian-vault-ops
description: Read and write Sapling brain files, manage wiki-links, and process markdown with YAML frontmatter. Use when working with vault file operations, creating logs, or managing links.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Obsidian Vault Operations Skill

Core operations for reading, writing, and managing files in a Sapling brain.

## Vault Structure

```text
brain/
|-- raw/                  # Source material: calls, email, GitHub PRs, imports, web clips
|-- wiki/                 # Durable markdown wiki and emergent concepts
|-- ops/                  # Daily logs, reviews, commitments, inboxes, PR queue
`-- outputs/              # Deliverables and generated artifacts
schemas/                  # Authoritative schema definitions
```

Legacy folders such as `brain/logs`, `brain/entities`, `brain/calls`, `brain/library`, and `brain/context` may exist during migration. Prefer the new structure for new files.

## File Operations

### Generated Outputs

When creating a durable artifact for the user, write it to `brain/outputs/YYYY-MM-DD-{slug}.md` or an appropriate typed subfolder using `schemas/vault/output.yaml`.

If the user did not ask to save the artifact, keep it in chat. Do not create generated drafts, plans, reports, or research logs in arbitrary folders.

### Raw Sources

Use `brain/raw/{source}/` for source material that should not be rewritten into polished memory. Examples:

- `brain/raw/calls/`
- `brain/raw/emails/`
- `brain/raw/github/{owner-repo}/prs/{number}.md`
- `brain/raw/web/`

Use `schemas/vault/raw-source.yaml`.

### Wiki Pages

Use `brain/wiki/` for durable business knowledge:

- `brain/wiki/people/`
- `brain/wiki/companies/`
- `brain/wiki/clients/`
- `brain/wiki/projects/`
- `brain/wiki/offers/`
- `brain/wiki/commitments/`
- `brain/wiki/decisions/`
- `brain/wiki/operating-model/`

Use `schemas/vault/wiki-page.yaml`. Include `source_refs` back to raw evidence whenever possible.

### Ops

Use `brain/ops/` for active operating state:

- Daily log: `brain/ops/daily/YYYY-MM-DD.md`
- Weekly review: `brain/ops/weekly/YYYY-Www.md`
- Active commitments: `brain/ops/commitments.md`
- PR review queue: `brain/ops/pr-queue.md`
- Triage inbox: `brain/ops/inbox.md`

Ops pages should stay concise and link to wiki pages and outputs.

## Wiki-Link Format

```markdown
[[wiki/projects/sapling]]                 # Durable project page
[[wiki/people/jane-smith|Jane Smith]]     # Link with alias
[[raw/github/org-repo/prs/42]]            # Raw PR source
[[ops/pr-queue]]                          # Active operating queue
[[outputs/2026-07-01-example-prd]]        # Durable output
```

## Common Patterns

### Daily Log Creation

1. Calculate today's date in `YYYY-MM-DD` format.
2. Check if `brain/ops/daily/{date}.md` exists.
3. If not, use `/today` or the daily-log schema example.
4. Write to `brain/ops/daily/{date}.md`.

### PR Review Context

1. Save raw PR context to `brain/raw/github/{owner-repo}/prs/{number}.md`.
2. Add the active item to `brain/ops/pr-queue.md`.
3. Update `brain/wiki/projects/{project}.md`.
4. Save review output to `brain/outputs/pr-reviews/YYYY-MM-DD-{repo}-pr-{number}.md`.

### Finding Related Context

1. Search `brain/wiki/` first for durable context.
2. Search `brain/raw/` for evidence and source detail.
3. Search `brain/outputs/` for past deliverables.
4. Search legacy folders only when migrating old vault content.

## Best Practices

1. Read `AGENTS.md` for the canonical Sapling contract.
2. Preserve YAML frontmatter.
3. Use schemas before inventing new fields.
4. Link raw evidence to wiki pages with `source_refs`.
5. Do not store durable business facts only in ops pages.
