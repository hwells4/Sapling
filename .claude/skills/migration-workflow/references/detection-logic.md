# Detection Logic

How to identify schema versions in vault files.

## Version Detection Algorithm

```
1. Extract frontmatter from file
2. Check for schema_version field:
   - Present → use that version
   - Missing → check for legacy signatures

3. For legacy detection, check known field patterns:
   - post_url, reactions, comments → legacy library (posts)
   - source_type without origin → library 1.0.0
```

## File Discovery

**By folder pattern:**
```
brain/library/posts/*.md    → library schema
brain/library/articles/*.md → library schema
brain/library/internal/*.md → library schema
brain/traces/*.md           → trace schema
brain/entities/*.md         → entity schema
brain/calls/*.md            → call schema
brain/outputs/*.md          → output schema
brain/inbox/*.md            → inbox schema
```

## Version Comparison

Compare file's schema_version against current schema version:

```python
# Pseudocode
file_version = frontmatter.get('schema_version', 'legacy')
schema_version = read_schema(schema_path).schema_version

if file_version == schema_version:
    status = 'current'
elif file_version == 'legacy':
    status = 'legacy'
else:
    status = 'outdated'
```

## Output Format

Detection results should show:

```
Schema: library (current: 1.2.0)
─────────────────────────────────
brain/library/posts/vibe-coding.md
  Version: legacy
  Status: needs migration
  Fields: author, post_url, reactions, comments

brain/library/articles/zapier-supabase-postgres.md
  Version: 1.0.0
  Status: needs migration (1.0.0 → 1.2.0)
  Fields: source_type, author

Total: 14 files need migration
```
