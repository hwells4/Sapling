---
schema_version: 1.0.0
date: 2026-07-01
updated: 2026-07-01
type: index
status: active
tags:
  - date/2026-07-01
  - wiki
  - wiki/index
  - status/active
---

# Wiki

Sapling's wiki is the durable business memory. Use it for context that should survive beyond one session.

## Catalog

Each entry should be a link plus a short description. Update this file when ingesting sources or creating materially useful pages.

### Starter Areas

- [[wiki/people]] - people mentioned in sources or useful to future work
- [[wiki/companies]] - companies and organizations
- [[wiki/clients]] - client relationships and account context
- [[wiki/projects]] - internal, client, and product projects
- [[wiki/topics]] - emergent concepts and recurring themes
- [[wiki/decisions]] - durable decisions and their evidence
- [[wiki/operating-model]] - stable preferences, business context, and working style

### Special Pages

- [[wiki/log]] - chronological record of ingests, queries, lint passes, and maintenance

## Rules

- Read this index before creating new pages.
- Prefer updating an existing page when the new source changes an attribute, status, or understanding of that page.
- Create a new page when the source introduces a distinct entity, project, decision, topic, or concept that should be linked from elsewhere.
- Link wiki pages back to raw evidence with `source_refs`.
- Keep active queues in [[ops/inbox]], [[ops/commitments]], and [[ops/pr-queue]].
- Save deliverables in `brain/outputs/`.
