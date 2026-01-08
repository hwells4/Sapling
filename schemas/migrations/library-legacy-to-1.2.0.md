# Migration: library legacy → 1.2.0

**Schema:** library
**From:** legacy (no schema_version)
**To:** 1.2.0
**Generated:** 2025-12-28

## Changelog

Files with NO `schema_version` and flat fields like `author`, `post_url`, `post_type`.

## Detection

Files matching:
- Missing `schema_version` field entirely
- Has fields: `post_url`, `reactions`, `comments`

## Transformation Rules

**Source pattern:**
```yaml
author: "[[entities/people/name|Name]]"
post_url: https://...
post_type: text
reactions: 38
comments: 15
tags: [linkedin-example, ...]
```

**Target pattern:**
```yaml
schema_version: 1.2.0
date: {existing date}
type: library
origin: external
source:
  url: {post_url}
  author: {extract from author wikilink or use raw}
  format: post
  platform: {infer from url}
topics: {extract from tags, excluding linkedin-example}
tags: [date/{date}, library, library/external, ...]
```

## Field Mappings

| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| author | source.author | Extract display name from wikilink or use raw |
| post_url | source.url | Direct copy |
| post_type | source.format | Map: text→post |
| reactions | body line | Move to body: `**Engagement:** X reactions, Y comments` |
| comments | body line | Combined with reactions |
| reposts | body line | Combined with reactions |
| tags | tags + topics | Split: topic tags → topics array |

## Platform Inference

- linkedin.com → `platform: linkedin`
- twitter.com/x.com → `platform: twitter`
- youtube.com → `platform: youtube`
- Otherwise → omit platform field
