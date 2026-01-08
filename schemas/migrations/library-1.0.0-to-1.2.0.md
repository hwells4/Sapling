# Migration: library 1.0.0 → 1.2.0

**Schema:** library
**From:** 1.0.0
**To:** 1.2.0
**Generated:** 2025-12-28

## Changelog

Restructured source fields into nested object; removed deprecated status fields.

## Detection

Files matching:
- `schema_version: 1.0.0`
- Has `source_type` field
- Missing `origin` field

## Transformation Rules

**Source pattern:**
```yaml
schema_version: 1.0.0
source_type: article
author: Harrison Wells
topics: [zapier, supabase]
status: working
last_verified: 2025-12-26
```

**Target pattern:**
```yaml
schema_version: 1.2.0
type: library
origin: external
source:
  url: {if exists}
  author: {author field}
  format: {source_type}
  platform: {infer if url exists}
topics: {existing topics}
```

## Field Mappings

| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| schema_version | schema_version | Update to 1.2.0 |
| source_type | source.format | Direct map |
| author | source.author | Direct copy |
| status | (remove) | Not in v1.2.0 |
| last_verified | (remove) | Not in v1.2.0 |
