# Migration Maps (DEPRECATED)

> **⚠️ DEPRECATED:** This file is superseded by versioned migration files in `schemas/migrations/`.
> Use `schemas/migrations/{schema}-{from}-to-{to}.md` for transformation rules.
> This file is kept for historical reference only.

Transformation rules for upgrading files between schema versions.

## Library Schema

### Legacy → 1.2.0

Files with NO `schema_version` and flat fields like `author`, `post_url`, `post_type`.

**Source patterns:**
```yaml
# Legacy format (posts)
author: "[[entities/people/name|Name]]"
post_url: https://...
post_type: text
reactions: 38
comments: 15
tags: [linkedin-example, ...]
```

**Transformation:**
```yaml
# Target format (1.2.0)
schema_version: 1.2.0
date: {existing date}
type: library
origin: external
source:
  url: {post_url}
  author: {extract from author wikilink or use raw}
  format: post
  platform: {infer from url: linkedin/twitter/etc}
topics: {extract from tags, excluding linkedin-example}
tags: [date/{date}, library, library/external, ...]
```

**Field mappings:**
| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| author | source.author | Extract display name from wikilink or use raw |
| post_url | source.url | Direct copy |
| post_type | source.format | Map: text→post |
| reactions | body line | Move to body: `**Engagement:** X reactions, Y comments, Z reposts` |
| comments | body line | (combined with reactions above) |
| reposts | body line | (combined with reactions above) |
| tags | tags + topics | Split: topic tags → topics, prefix with library namespace |

**Platform inference:**
- linkedin.com → `platform: linkedin`
- twitter.com/x.com → `platform: twitter`
- youtube.com → `platform: youtube`
- Otherwise → omit platform field

### 1.0.0 → 1.2.0

Files with `schema_version: 1.0.0` and `source_type` field.

**Source patterns:**
```yaml
schema_version: 1.0.0
source_type: article
author: Harrison Wells
topics: [zapier, supabase]
```

**Transformation:**
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

**Field mappings:**
| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| source_type | source.format | Map: article→article, post→post |
| author | source.author | Direct copy |
| status | (remove) | Not in v1.2.0 |
| last_verified | (remove) | Not in v1.2.0 |

## Trace Schema

### 1.0.0 → 1.1.0

**Transformation:**
```yaml
# Add type field based on content
type: trace  # default, unless has hypothesis indicators
```

## Detection Signatures

### Legacy (no schema_version)
- Missing `schema_version` field entirely
- Has fields like: `post_url`, `reactions`, `comments`

### 1.0.0 library
- `schema_version: 1.0.0`
- Has `source_type` field
- Missing `origin` field

### 1.1.0 trace
- `schema_version: 1.1.0`
- Has `type` field
- Current - no migration needed
