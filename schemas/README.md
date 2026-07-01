# Schemas

Schemas keep Sapling greppable, parseable, and safe for agents to update.

Every durable markdown file in `brain/` should have frontmatter that matches a schema in `schemas/vault/`. The hook validator uses these schemas to catch malformed files before they become permanent context.

## Current Brain Schemas

| Schema | Location | Purpose |
|--------|----------|---------|
| `raw-source` | `brain/raw/` | Source material, imports, transcripts, PR payloads |
| `wiki-page` | `brain/wiki/` | Durable business memory and first-class pages |
| `daily-log` | `brain/ops/daily/` | Daily operating log |
| `weekly-log` | `brain/ops/weekly/` | Weekly review |
| `ops-page` | `brain/ops/` | Active inboxes, commitments, and PR queues |
| `output` | `brain/outputs/` | Deliverables and generated artifacts |

## Legacy Schemas

The older `call`, `entity`, and `library` schemas remain for migration compatibility with existing HarryOS/Sapling vaults. New installs should prefer:

- `brain/raw/calls/` instead of `brain/calls/`
- `brain/wiki/people/` and `brain/wiki/companies/` instead of `brain/entities/`
- `brain/raw/web/` or `brain/wiki/content/` instead of `brain/library/`
- `brain/wiki/operating-model/` instead of `brain/context/`

## Adding New Schemas

1. Create `schemas/vault/{name}.yaml`.
2. Include `schema_version`, `changelog`, `frontmatter.required`, and an `example` block.
3. Update `.claude/hooks/router/scripts/validate-vault-schema.py` if the new schema maps to a new folder.
4. Update `schemas/tags/taxonomy.yaml` with any new tag namespaces.
