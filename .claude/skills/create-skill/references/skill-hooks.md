# Skill-Scoped Hooks

Skills can declare hooks in YAML frontmatter. Hooks activate when skill loads; clean up when skill finishes.

## Frontmatter Syntax

```yaml
---
name: my-skill
description: Skill with scoped hooks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "python3 \"$CLAUDE_PLUGIN_ROOT\"/scripts/validate.py"
  Stop:
    - hooks:
        - type: prompt
          prompt: "Check success criteria. $ARGUMENTS"
          timeout: 30
---
```

## What Works Reliably

| Event | In Frontmatter | Notes |
|-------|---------------|-------|
| PreToolUse | Yes | Matcher support, blocks tools |
| PostToolUse | Yes | Matcher support, feedback only |
| SessionStart | Yes | Use `once: true` for setup |
| Stop | **Unreliable** | See "Stop Hook Gotcha" below |
| SubagentStop | Yes | For forked subagents only |

## The Stop Hook Gotcha

**Stop hooks in skill frontmatter do not fire reliably for inline skills** (GitHub #19225, closed NOT_PLANNED).

- Inline skill (no `context: fork`): Stop hook may never fire
- Forked subagent: Stop hooks auto-convert to `SubagentStop`

**If your skill needs completion validation, use one of these patterns instead:**

1. **Global Stop hook** in `settings.json` with skill-awareness logic
2. **Prompt-based Stop hook** in frontmatter (works for forked/subagent skills)
3. **PostToolUse validation** — validate after specific tool calls rather than at completion

For pattern 1 (most reliable): invoke `create-hook` with intent "skill stop hook" → `workflows/create-skill-stop-hook.md`

## Environment Variables

| Variable | Scope | Value |
|----------|-------|-------|
| `CLAUDE_PLUGIN_ROOT` | Component hooks only | Absolute path to skill directory |
| `CLAUDE_PROJECT_DIR` | All hooks | Absolute path to project root |

Scripts ship with the skill in `scripts/`; reference via `$CLAUDE_PLUGIN_ROOT`.

## The `once` Option

```yaml
hooks:
  SessionStart:
    - hooks:
        - type: command
          command: "./scripts/setup.sh"
        - once: true
```

Runs once per session even if skill triggers multiple times. Resets on session restart.

## When to Use Skill-Scoped Hooks

| Signal | Use Skill Hook | Use Global Hook |
|--------|---------------|-----------------|
| Hook only relevant when skill active | Yes | No |
| Hook should be portable with skill | Yes | No |
| Need reliable Stop validation | No | Yes — invoke `create-hook` |
| Project-wide policy enforcement | No | Yes |
| Hook requires tool access | No | Yes (agent type) |

## When Skill Reliability Is Low

If a skill frequently fails to complete its success criteria:

1. Check if the skill has clear `<success_criteria>` defined
2. If yes but agent still skips steps → **build a skill stop hook**
3. Invoke: `/create-hook` → "skill stop hook" → select the target skill
4. This creates a global Stop hook that validates the skill's output

The stop hook reads the skill's success criteria and blocks completion until met. See `create-hook/workflows/create-skill-stop-hook.md` for the full pattern.

## Script Organization

```
my-skill/
├── SKILL.md              # hooks in frontmatter
├── scripts/
│   ├── validate.py       # PreToolUse validation
│   └── check-output.sh   # PostToolUse checks
├── workflows/
└── references/
```

Workflow says WHEN. Hook scripts enforce HOW. Keep scripts as pure validation — no domain logic.
