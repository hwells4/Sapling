---
name: migration-workflow
description: Migrate vault files to current schema versions. Use when files have outdated frontmatter, missing schema_version, or need bulk updates to match current schema definitions. Detects, previews, and applies migrations with validation.
context_budget:
  skill_md: 180
  max_references: 3
---

<objective>
Migrate vault files from legacy formats to current schema versions while preserving content. Support detection, preview, and batch operations with validation.
</objective>

<essential_principles>
1. **Dry-run first** - Always show what would change before applying
2. **Content preservation** - Only modify frontmatter, never touch body content
3. **Validation required** - Migrated files must pass schema validation
4. **Reversible** - Original files can be recovered via git
5. **Schema-driven** - All transformations derive from schema changelog
</essential_principles>

<quick_start>
Most common: Migrate all library files to current schema

1. Run `/migrate library`
2. Review files needing migration and transformations
3. Confirm to apply all, or select individual files

Output: Files updated with current schema_version and structure
</quick_start>

<intake>
What would you like to do?

1. **Detect outdated files** → workflows/detect.md
   - Find files with missing/outdated schema_version

2. **Preview migration** → workflows/preview.md
   - Show before/after diff for specific files

3. **Migrate files** → workflows/migrate.md
   - Apply transformations (interactive or batch)

Specify schema name: `library`, `trace`, `entity`, `call`, `output`, `inbox`
</intake>

<routing>
**Step 1: Always detect first**
```bash
python3 scripts/migrate-batch.py detect --schema {schema}
```

**Step 2: Route based on count**
| File Count | Workflow |
|------------|----------|
| 0 files | Report "all files current", done |
| 1-10 files | workflows/migrate.md (interactive) |
| 11+ files | workflows/batch.md (parallel agents) |

**Direct routing:**
| User Intent | Workflow |
|-------------|----------|
| "what needs migration" | detect only, report results |
| "preview migration for X" | workflows/preview.md |
| "resume migration" | workflows/batch.md (check state first) |
| "migration status" | `python3 scripts/migrate-batch.py status` |
</routing>

<schema_locations>
| Schema | Path |
|--------|------|
| library | schemas/vault/library.yaml |
| trace | schemas/vault/trace.yaml |
| entity | schemas/vault/entity.yaml |
| call | schemas/vault/call.yaml |
| output | schemas/vault/output.yaml |
| inbox | schemas/vault/inbox.yaml |

*Read the schema file directly for current version (check `schema_version:` field).*
</schema_locations>

<file_to_schema_mapping>
| Folder Pattern | Schema |
|----------------|--------|
| brain/library/ | library |
| brain/traces/ | trace |
| brain/entities/ | entity |
| brain/calls/ | call |
| brain/outputs/ | output |
| brain/inbox/ | inbox |
</file_to_schema_mapping>

<references_index>
| Reference | Purpose |
|-----------|---------|
| schemas/migrations/{schema}-{from}-to-{to}.md | Versioned migration rules (e.g., call-1.0.0-to-1.1.0.md) |
| schemas/migrations/README.md | Migration file conventions and running migrations |
| references/detection-logic.md | How to identify file schema versions |
</references_index>

<success_criteria>
- [ ] All targeted files have current schema_version
- [ ] Frontmatter matches current schema structure
- [ ] Body content unchanged
- [ ] Files pass validation hook
</success_criteria>
