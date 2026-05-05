---
description: Create or open today's daily log
---

# /today

Create or open today's daily log without scanning email or inbox queues.

## Execute

1. Determine today's date in `YYYY-MM-DD` format.
2. If `brain/logs/daily/{date}.md` exists, read it and summarize the current sections.
3. If it does not exist, create it from the daily-log schema shape:

```markdown
---
schema_version: 1.0.0
date: {date}
type: daily
tags: [date/{date}, daily]
---

# {weekday}, {month} {day}, {year}

## Focus

## Tasks

## Notes

## Created Today

## Decisions Made

## Session Log
```

4. Ask what the user wants to focus on today only if the user did not provide a focus.
