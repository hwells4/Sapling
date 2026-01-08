---
name: obsidian-vault-ops
description: Read and write Obsidian vault files, manage wiki-links, process markdown with YAML frontmatter. Use when working with vault file operations, creating notes, or managing links.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Obsidian Vault Operations Skill

Core operations for reading, writing, and managing files in an Obsidian vault.

## Vault Structure

```
brain/
├── notes/daily/          # YYYY-MM-DD.md daily notes
├── notes/weekly/         # YYYY-Www.md weekly notes
├── calls/                # Call notes (flat)
├── outputs/              # Deliverables
├── traces/               # Decision traces
├── library/              # Reference material (posts, etc.)
├── context/              # AI context files
├── triage/               # Unclassified items
└── templates/            # File templates
entities/                 # People and companies (flat, no type subfolders)
schemas/                  # Authoritative schema definitions (YAML)
```

## File Operations

### Reading Notes
- Use Glob to find files: `brain/notes/daily/*.md`, `entities/*.md`
- Read CLAUDE.md first for vault context
- Check for wiki-links to related notes

### Creating Notes
1. Check if note already exists
2. Use the appropriate command (e.g., `/daily`, `/weekly`) - templates are injected by hooks
3. Add YAML frontmatter with date and tags
4. Insert wiki-links to related notes

### Editing Notes
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

### Daily Note Creation
1. Calculate today's date in YYYY-MM-DD format
2. Check if `brain/notes/daily/{date}.md` exists
3. If not, use `/daily` command (template is injected automatically by hook)
4. Write to `brain/notes/daily/{date}.md`

**Note:** Use `/daily` command which receives injected templates - don't read schemas manually.

### Entity Linking
- People and companies use flat entity structure
- Link format: `[[entities/{slug}|Display Name]]`
- No type subfolders (not `entities/people/` or `entities/companies/`)

### Finding Related Notes
1. Extract key terms from current note
2. Search vault for matching content
3. Suggest wiki-links to related notes

### Tag Operations
- Priority: `#priority/high`, `#priority/medium`, `#priority/low`
- Status: `#active`, `#waiting`, `#completed`, `#archived`
- Context: `#work`, `#personal`, `#health`, `#learning`

## Best Practices

1. Always check CLAUDE.md for vault-specific conventions
2. Preserve existing structure when editing
3. Use relative paths for internal links
4. Add frontmatter to new notes
5. Use commands (e.g., `/daily`, `/weekly`) which receive injected templates from hooks
6. Entities are flat - use `entities/{slug}` not `entities/people/{slug}`
