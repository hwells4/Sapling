---
description: Create, edit, analyze, or debug Claude Code hooks
argument-hint: <new|edit|debug|analyze or request>
---

# /create-hook Command

Create or maintain Claude Code hooks for Sapling.

## Usage

```
/create-hook analyze
/create-hook new PreToolUse validate-output-location
/create-hook debug .claude/hooks/my-hook.py
```

## On Invocation

1. Read `.claude/skills/create-hook/SKILL.md`.
2. Route to create, edit, debug, analyze, or template mode.
3. Use existing hook inventory before adding new hook behavior.
4. Validate hook JSON input/output behavior before updating settings.

## Request

$ARGUMENTS

Execute the create-hook skill with request = `$ARGUMENTS`.

If `$ARGUMENTS` is empty, show the intake menu from the skill.
