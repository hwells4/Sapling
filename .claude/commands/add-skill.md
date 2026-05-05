---
description: Create or modify Claude Code skills with context engineering
argument-hint: <skill-name or request>
---

# /add-skill Command

Create well-structured, context-efficient Claude Code skills.

## Usage

```
/add-skill my-new-skill     # Create a new skill
/add-skill                  # Interactive - asks what you need
```

## On Invocation

1. **Read skill** `.claude/skills/create-skill/SKILL.md`
2. **Classify archetype** (simple/router/orchestrator/reference)
3. **Load appropriate workflow** based on archetype
4. **Generate skill files** following context engineering principles
5. **Validate** context budget and structure

## Request: $ARGUMENTS

Execute the create-skill skill with request = $ARGUMENTS.

If $ARGUMENTS is empty, show the intake menu from the skill.
