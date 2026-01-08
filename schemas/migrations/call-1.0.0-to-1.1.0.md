# Call Schema Migrations

Migration rules for `schemas/vault/call.yaml`

## 1.0.0 → 1.1.0

**Changelog:** Added person/, company/, signal/ tags; removed redundant topics field

**Source pattern:**
```yaml
schema_version: 1.0.0
date: 2025-12-11
type: call
company: "[[entities/acme-corp]]"
people:
  - "[[entities/john-doe]]"
  - "[[entities/jane-smith]]"
topics: [ai-strategy, pricing]
tags:
  - date/2025-12-11
  - call
  - client/acme
```

**Target pattern:**
```yaml
schema_version: 1.1.0
date: 2025-12-11
type: call
company: "[[entities/acme-corp]]"
people:
  - "[[entities/john-doe]]"
  - "[[entities/jane-smith]]"
tags:
  - date/2025-12-11
  - call
  - client/acme
  - company/acme-corp
  - person/john-doe
  - person/jane-smith
  - signal/interest-high
```

**Field mappings:**
| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| schema_version | schema_version | Update to 1.1.0 |
| topics | (remove) | Field removed in 1.1.0 |
| company | tags += company/{slug} | Extract slug from wikilink, add tag |
| people | tags += person/{slug} | Extract slug from each wikilink, add tags |
| signals | tags += signal/{type}-{value} | If signals exist, convert to tags |

**Slug extraction from wikilinks:**
- `[[entities/john-doe]]` → `john-doe`
- `[[entities/acme-corp|Acme Corporation]]` → `acme-corp`

**Signal tag format:**
- `interest: high` → `signal/interest-high`
- `budget: confirmed` → `signal/budget-confirmed`

## Detection Signatures

**1.0.0:**
- `schema_version: 1.0.0`
- Missing `person/` and `company/` tags
- May have `topics` field (removed in 1.1.0)
