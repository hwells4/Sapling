# Core Principles of Context Engineering

These principles apply to every skill. Internalize them.

## The Core Problem

As context length increases, models exhibit predictable degradation:
- "Lost-in-the-middle" phenomenon
- U-shaped attention curves
- Attention scarcity

**Guiding principle:** Find "the smallest set of high-signal tokens that maximize the likelihood of some desired outcome."

## 1. Progressive Disclosure

**Don't load everything upfront. Structure content in layers.**

```
Layer 1: Metadata
├── name, description
├── ~30-50 tokens at startup
└── Loaded for ALL skills

Layer 2: SKILL.md
├── Loaded when skill triggers
├── Max 200 lines (router) or 150 lines (simple)
└── Contains essential principles + routing

Layer 3: Supporting files
├── Loaded on-demand during execution
├── Referenced by <required_reading>
└── Zero tokens until needed
```

**Key insight:** The constraint isn't "how much can I include?" but "how do I structure so Claude loads only what's needed?"

## 2. Conciseness Principle

> "The context window is a public good."

**Default assumption:** Claude is already very smart.

**Before adding any content, ask:**
- Does Claude need this explanation, or does it already know?
- Can this be in a reference file instead of inline?
- Is this the minimum needed to accomplish the goal?
- Does this paragraph justify its token cost?

**Token efficiency comparison:**
| Approach | Efficiency |
|----------|------------|
| Monolithic dump (25,000 tokens, ~200 relevant) | 0.8% |
| Progressive disclosure (load what's needed) | ~100% |

## 3. Pure XML Structure

**Use XML blocks, not markdown headings.**

```xml
<!-- Good: XML blocks -->
<objective>
Clear goal statement
</objective>

<process>
Step-by-step instructions
</process>
```

```markdown
<!-- Bad: Markdown headings -->
## Objective
Clear goal statement

## Process
Step-by-step instructions
```

**Why XML:**
- 25% token savings vs markdown headings
- Unambiguous section boundaries
- Consistent parsing across all skills
- Better Claude performance (less inference)

## 4. Required Reading Pattern

**Every workflow declares which references to load.**

```xml
<required_reading>
- references/core-principles.md (always)
- references/specific-topic.md (for this workflow only)
</required_reading>
```

**This ensures:**
- Context is task-specific, not monolithic
- Irrelevant references stay on disk (0 tokens)
- Explicit about what knowledge is needed

## 5. One Level Deep

**All references link directly from SKILL.md or workflows.**

```
Good:
SKILL.md → references/topic.md

Bad:
SKILL.md → references/index.md → references/actual-content.md
```

**Why:** Claude may use `head -100` to preview rather than reading complete files. Nested references break this.

## 6. Essential Principles Inline

**Critical content goes directly in SKILL.md.**

Content that:
- Must always be loaded
- Cannot be skipped
- Shapes every workflow

Put it inline in SKILL.md, not in a reference. It loads automatically when the skill triggers.

## Summary

| Principle | Implementation |
|-----------|----------------|
| Progressive disclosure | Layers 1→2→3, load on demand |
| Conciseness | Only add what Claude doesn't know |
| Pure XML | `<blocks>` not `## Headings` |
| Required reading | Explicit in each workflow |
| One level deep | Direct links only |
| Essential inline | Critical content in SKILL.md |
