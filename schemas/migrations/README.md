# Schema Migrations

Migration files for upgrading vault files between schema versions.

## File Naming Convention

```
{schema}-{from_version}-to-{to_version}.md
```

Examples:
- `call-1.0.0-to-1.1.0.md`
- `library-legacy-to-1.2.0.md`
- `entity-1.1.0-to-1.2.0.md`

## Automatic Generation

When a schema file (`schemas/vault/*.yaml`) is updated, a PostToolUse hook:

1. Detects the new version from changelog
2. Generates a migration file with template
3. Pre-populates transformation rules from changelog

The agent refines the rules if needed.

## Migration File Template

```markdown
# Migration: {schema} {from} → {to}

**Schema:** {schema}
**From:** {from_version}
**To:** {to_version}
**Generated:** {date}

## Changelog

{description from schema changelog}

## Detection

Files matching:
- {how to identify files at source version}

## Transformation Rules

**Source pattern:**
{yaml}

**Target pattern:**
{yaml}

## Field Mappings

| Old Field | New Field | Transform |
|-----------|-----------|-----------|
```

## Running Migrations

```bash
# Detect what needs migration
python3 scripts/migrate-batch.py detect --schema call

# Initialize state
python3 scripts/migrate-batch.py init --schema call

# Use /migrate skill to run
/migrate call --batch
```
