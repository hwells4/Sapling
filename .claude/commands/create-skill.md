---
description: Create or modify Claude Code skills with context engineering
argument-hint: <skill-name or request>
---

# /create-skill Command

Create well-structured, context-efficient Claude Code skills.

## Usage

```
/create-skill my-new-skill     # Create a new skill
/create-skill                  # Interactive - asks what you need
```

## On Invocation

1. Read `.claude/skills/create-skill/SKILL.md`.
2. Classify archetype: simple, router, orchestrator, or reference.
3. Load the matching workflow.
4. Generate skill files following context engineering principles.
5. Validate context budget and structure.

## Request

$ARGUMENTS

Execute the create-skill skill with request = `$ARGUMENTS`.

If `$ARGUMENTS` is empty, show the intake menu from the skill.
