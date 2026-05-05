# Schemas

Schemas keep Sapling OS greppable and searchable as it scales.

## Why Schemas?

Every file in `brain/` follows a schema. This means:

- **Consistent structure** - Files of the same type always have the same frontmatter fields
- **Searchable** - You can `grep` for any field across hundreds of files
- **Parseable** - Scripts can reliably extract and process data
- **Validated** - The schema hook ensures Claude always writes files correctly

Without schemas, your vault becomes a mess of inconsistent formats that breaks tooling.

## How It Works

### 1. Schema Definitions (`vault/`)

Each file type has a YAML schema defining:
- Required and optional frontmatter fields
- Field types and validation rules
- File location and naming patterns
- Purpose and usage notes

```
schemas/vault/
├── call.yaml        # Call notes
├── daily-log.yaml   # Daily operating log
├── entity.yaml      # People, companies
├── library.yaml     # Saved content
├── output.yaml      # Posts, PRDs, deliverables
└── weekly-log.yaml  # Weekly review log
```

### 2. Schema Hook

When Claude creates or edits files in `brain/`, a hook validates the output against the schema. If something's wrong, it catches it immediately.

This means you never end up with malformed files—Claude writes it right the first time, every time.

## Quick Reference

| Schema | Location | Purpose |
|--------|----------|---------|
| `call` | `brain/calls/` | Call notes and meeting records |
| `entity` | `brain/entities/` | People and company profiles |
| `library` | `brain/library/` | Saved articles, resources |
| `output` | `brain/outputs/` | Deliverables (posts, PRDs, emails) |
| `daily-log` | `brain/logs/daily/` | Daily logs |
| `weekly-log` | `brain/logs/weekly/` | Weekly reviews |

## Adding New Schemas

1. Create `schemas/vault/{name}.yaml` with full definition
2. Include `schema_version`, `changelog`, field definitions
3. The hook picks it up automatically

See existing schemas for the format.
