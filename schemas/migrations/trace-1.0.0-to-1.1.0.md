# Trace Schema Migrations

Migration rules for `schemas/vault/trace.yaml`

## 1.0.0 → 1.1.0

**Source pattern:**
```yaml
schema_version: 1.0.0
date: 2025-12-27
# missing type field
```

**Target pattern:**
```yaml
schema_version: 1.1.0
date: 2025-12-27
type: trace
```

**Field mappings:**
| Old Field | New Field | Transform |
|-----------|-----------|-----------|
| (none) | type | Add `type: trace` (default) |
| schema_version | schema_version | Update to 1.1.0 |

## Detection Signatures

**1.0.0:**
- `schema_version: 1.0.0`
- Missing `type` field
