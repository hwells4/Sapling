---
name: obsidian-vault-ops
description: Read and write Obsidian vault files, manage wiki-links, process markdown with YAML frontmatter. Use when working with vault file operations, creating logs, or managing links.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Obsidian Vault Operations Skill

Core operations for reading, writing, and managing files in an Obsidian vault.

## Vault Structure

```
brain/
├── logs/daily/          # YYYY-MM-DD.md daily logs
├── logs/weekly/         # YYYY-Www.md weekly logs
├── calls/                # Call notes (flat)
├── outputs/              # Deliverables
├── library/              # Reference material (posts, etc.)
├── context/              # AI context files
└── templates/            # File templates
entities/                 # People and companies (flat, no type subfolders)
schemas/                  # Authoritative schema definitions (YAML)
```

## File Operations

### Generated Outputs
When creating a durable artifact for the user, write it to `brain/outputs/YYYY-MM-DD-{slug}.md` using `schemas/vault/output.yaml`.

If the user did not ask to save the artifact, keep it in chat. Do not create generated drafts, plans, reports, or research logs in arbitrary folders.

### Reading Logs
- Use Glob to find files: `brain/logs/daily/*.md`, `entities/*.md`
- Read CLAUDE.md first for vault context
- Check for wiki-links to related logs

### Creating Logs
1. Check if log already exists
2. Use the appropriate command (e.g., `/today`, `/weekly`) - templates are injected by hooks
3. Add YAML frontmatter with date and tags
4. Insert wiki-links to related logs

### Editing Logs
- Preserve YAML frontmatter structure
- Maintain existing wiki-links
- Use consistent heading hierarchy
- Apply standard tag format

## Wiki-Link Format

```markdown
[[Note Name]]                    # Simple link
[[Note Name|Display Text]]       # Link with alias
[[Note Name#Section]]            # Link to section
[[entities/person-slug]]         # Link to entity (flat structure)
```

## YAML Frontmatter

Standard frontmatter structure:
```yaml
---
date: 2024-01-15
tags: [tag1, tag2]
status: active
---
```

## Template Variables

When processing templates, replace:
- `{{date}}` - Today's date (YYYY-MM-DD)
- `{{date:format}}` - Formatted date
- `{{date-1}}` - Yesterday
- `{{date+1}}` - Tomorrow
- `{{time}}` - Current time

## Common Patterns

### Daily Log Creation
1. Calculate today's date in YYYY-MM-DD format
2. Check if `brain/logs/daily/{date}.md` exists
3. If not, use `/today` command (template is injected automatically by hook)
4. Write to `brain/logs/daily/{date}.md`

**Note:** Use `/today` command which receives injected templates - don't read schemas manually.

### Entity Linking
- People and companies use flat entity structure
- Link format: `[[entities/{slug}|Display Name]]`
- No type subfolders (not `entities/people/` or `entities/companies/`)

### Finding Related Logs
1. Extract key terms from current log
2. Search vault for matching content
3. Suggest wiki-links to related logs

### Tag Operations
- Priority: `#priority/high`, `#priority/medium`, `#priority/low`
- Status: `#active`, `#waiting`, `#completed`, `#archived`
- Context: `#work`, `#personal`, `#health`, `#learning`

## Best Practices

1. Always check CLAUDE.md for vault-specific conventions
2. Preserve existing structure when editing
3. Use relative paths for internal links
4. Add frontmatter to new logs
5. Use commands (e.g., `/today`, `/weekly`) which receive injected templates from hooks
6. Entities are flat - use `entities/{slug}` not `entities/people/{slug}`
