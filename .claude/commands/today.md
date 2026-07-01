---
description: Create or open today's ops daily log
---

# /today

Create or open today's daily operating log without scanning external task queues.

## Execute

1. Determine today's date in `YYYY-MM-DD` format.
2. If `brain/ops/daily/{date}.md` exists, read it and summarize the current sections.
3. If it does not exist, create it from the daily-log schema shape:

````markdown
---
schema_version: 1.1.0
date: {date}
type: daily
week: "[[ops/weekly/{week}]]"
month: "[[ops/monthly/{month}]]"
tags: [date/{date}, daily, ops]
---

# {weekday}, {month_name} {day}, {year}

<< [[ops/daily/{yesterday}]] | [[ops/daily/{tomorrow}]] >>

## Focus

## Commitments
- [ ] Review active commitments in [[ops/commitments]]

## Work Queue
- PRs: [[ops/pr-queue]]
- Beads: `bd ready`

## Created Today
```dataview
LIST FROM #date/{date} WHERE file.name != this.file.name
SORT type
```

## Decisions Made
*None yet*

## Session Log
````

4. Ask what the user wants to focus on today only if the user did not provide a focus.
