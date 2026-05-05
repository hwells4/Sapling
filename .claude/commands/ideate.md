---
description: Generate and winnow improvement ideas
argument-hint: [optional plan file or project context]
---

# /ideate - Generate Best Improvement Ideas

Run the Idea Wizard: generate 30 ideas, think through each, winnow to the very best 5.

## Usage
```
/ideate                    # Run on current project
/ideate path/to/plan.md    # Run on specific plan file
```

## What It Does
1. Generates 30 improvement ideas across:
   - Robustness and reliability
   - Performance and efficiency
   - User-friendliness and UX
   - Developer ergonomics
   - Compelling features

2. Thinks through EACH idea:
   - How would it work?
   - How would users perceive it?
   - How would we implement it?

3. Winnows to the VERY best 5 with full rationale

## Workflow

Invoke the plan-refinery skill with the ideas workflow:

```
Read .claude/skills/plan-refinery/workflows/idea-wizard.md and execute it.
```

If arguments provided, use them as context. Otherwise, detect context from:
1. Beads (`bd list --status=open`)
2. Current codebase exploration
