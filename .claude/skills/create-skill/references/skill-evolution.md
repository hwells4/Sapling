# Skill Evolution Patterns

Skills are living systems, not static documents. They drift out of alignment with user preferences over 3-4 months unless designed for iterative change. This reference covers three patterns that prevent full rebuilds.

## Design Principle: Stable Core + Evolving Periphery

```
skill-name/
├── SKILL.md              ← STABLE (changes ~2x/year)
├── workflows/            ← STABLE (changes when new capability added)
├── references/           ← STABLE (domain knowledge, rarely shifts)
├── scripts/              ← STABLE (pure I/O, no business logic)
└── learnings.md          ← EVOLVES (every run can update this)
```

The SKILL.md and workflows define *what* the skill does. The `learnings.md` captures *how it works best for this user* — preferences, gotchas, and accumulated intelligence that prevents repeating mistakes.

## Pattern 1: Skill-Level Learnings (`learnings.md`)

A file at the skill root that Claude reads before acting and updates after discovering something new.

### Structure

```markdown
# Learnings

## Preferences
- (2026-03) Harrison prefers shortlist as CSV not xlsx — easier to forward
- (2026-04) Skip companies with "consulting" in name unless revenue >$5M

## Gotchas
- (2026-03) Grata exports sometimes have merged cells in row 1 — skip header detection on merged
- (2026-04) openpyxl read_only=True fails on files with chart sheets — use read_only=False

## What Failed
- (2026-03) Batch size 100 exceeded context window — max 50 companies per scoring pass

## Rules
- Always confirm output format before generating (user preference changes)
- Round revenue to nearest $100K in shortlist output
```

### How It Works

1. Skill triggers → Claude reads `learnings.md` (if exists)
2. Learnings inform execution (preferences override defaults, gotchas prevent known failures)
3. During execution, Claude encounters something new — a user correction, an unexpected error, a preference expressed
4. After task completes → Claude appends atomic entry with date
5. Next invocation → Claude reads updated learnings, is immediately smarter

### Rules for Healthy Learnings

- **Atomic entries**: One insight per bullet. Specific enough to act on.
- **Date everything**: Learnings age. A preference from 6 months ago may be stale.
- **Prune quarterly**: When re-reading, delete entries contradicted by newer ones.
- **30 lines max**: If it's growing past 30 lines, some entries belong in references instead.
- **Never duplicate SKILL.md**: Learnings capture *discovered* knowledge, not *designed* behavior.

### When to Add a `learnings.md`

Add when the skill:
- Interacts with external systems that change (APIs, file formats, tools)
- Has user preferences that drift (output format, sources, exclusions)
- Runs repeatedly where each run could inform the next
- Uses scripts that may encounter new edge cases

Skip when:
- Skill is pure process (migration, commit) with no external variability
- Skill runs once and is done (onboarding, setup)

## Pattern 2: Living Knowledge Files

For skills with scripts that parse external data (APIs, exports, file formats), separate the knowledge from the code.

### The Problem

```python
# BAD: Business logic encoded in script
EXPECTED_COLUMNS = ["Company Name", "Revenue", "Employees"]
# When Grata renames "Company Name" to "Name" → script breaks
```

### The Solution

```
scripts/discover.py      ← Pure I/O: discovers structure, outputs JSON
references/schema.md     ← Living knowledge: what structure looks like
```

The script discovers reality. The knowledge file interprets it. Claude bridges the gap.

### Living Knowledge File Structure

```markdown
# [Format] Schema Knowledge

## Expected Structure
- Tab "Companies": columns A-Z (headers in row 1)
- Key columns: Name (A), Revenue (F), Employees (G), Founded (H)

## Known Variants
- "Company Name" → renamed to "Name" as of 2026-03
- "Annual Revenue" → sometimes "Revenue (USD)"

## Change History
- 2026-04-15: New column "AI Readiness Score" added at position AA
- 2026-03-01: "Company Name" renamed to "Name"

## Mapping Rules
- Match columns by position + sample values, not just header name
- If header unknown but position/data matches → add as variant
- If structure unrecognizable → STOP and ask user
```

### Self-Healing Flow

```
Normal:     discover.py → compare to schema.md → match → proceed
Changed:    discover.py → compare to schema.md → diff found →
            Claude identifies what changed → adapts mapping →
            UPDATES schema.md → proceeds
Unknown:    discover.py → compare to schema.md → unrecognizable →
            STOP → ask user → human confirms → update schema.md
```

The script never changes. The knowledge file evolves. Each run makes the next run more resilient.

## Pattern 3: When to Use Which

| Signal | Pattern | Example |
|--------|---------|---------|
| User corrects output style | learnings.md | "I prefer bullet points not tables" |
| External format changes | Living knowledge file | API response adds new field |
| Script hits new error | learnings.md (Gotchas) | "openpyxl fails on chart sheets" |
| New exclusion rule | learnings.md (Rules) | "Skip companies < 5 employees" |
| Entire tab structure changes | Living knowledge + escalation | Grata redesigns export |
| User wants different sources | learnings.md (Preferences) | "Don't use LinkedIn anymore" |

## Integrating Into Skill Design

When building a new skill, ask:
1. Will this skill run repeatedly? → Consider `learnings.md`
2. Does it parse external data? → Consider living knowledge file
3. Are user preferences likely to drift? → Definitely add `learnings.md`
4. Does it use scripts? → Scripts stay dumb; knowledge stays in `.md` files

### SKILL.md Integration

Add to your skill's process steps:

```xml
<process>
## Step 0: Load Context [LOW]
1. Read `learnings.md` if it exists
2. Apply any relevant preferences or gotchas to this run
...
## Step N+1: Capture Learnings [LOW]
1. If user expressed a new preference → append to learnings.md
2. If unexpected error was resolved → append to Gotchas
3. If external format changed → update relevant knowledge file
</process>
```

## Anti-Patterns

- **Bloated learnings**: >30 lines means some entries should be promoted to references or deleted
- **Learnings duplicating SKILL.md**: If it's core behavior, put it in the skill. Learnings are *discovered*, not *designed*
- **Script with embedded knowledge**: If the script "knows" what columns to expect, that knowledge belongs in a `.md` file
- **Never pruning**: Old entries contradict new ones. Date entries and prune when re-reading.
- **Learnings as a log**: Not a diary. Only actionable insights that change future behavior.
