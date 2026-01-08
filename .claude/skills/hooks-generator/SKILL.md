---
name: hooks-generator
description: Quickly spin up Claude Code hooks for automation. Generates bash scripts, Python handlers, and settings.json configuration for PreToolUse, PostToolUse, SessionStart, Stop, and other hook events.
invocation: user
context_budget:
  skill_md: 200
  max_references: 2
---

<objective>
Generate Claude Code hooks quickly with proper configuration, input handling, and output formatting. Takes care of boilerplate so you focus on logic.
</objective>

<essential_principles>
1. **Settings location matters** - User (`~/.claude/settings.json`), project (`.claude/settings.json`), or local (`.claude/settings.local.json`)
2. **Input via stdin** - Hooks receive JSON with session_id, tool_name, tool_input, etc.
3. **Output via exit codes** - 0=success, 2=blocking error (stderr shown to Claude)
4. **Parallel execution** - All matching hooks run simultaneously
5. **Scripts in `.claude/hooks/`** - Use `$CLAUDE_PROJECT_DIR` for portability
</essential_principles>

<intake>
**Commands:**
1. `/hooks new <event> <name>` - Create a new hook (PreToolUse, PostToolUse, SessionStart, etc.)
2. `/hooks template <type>` - Show a template (validation, auto-approve, context-injection, stop-gate)
3. `/hooks add-to-settings` - Add hook to settings.json
4. `/hooks list` - Show all configured hooks

**Event types:** PreToolUse, PostToolUse, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, SessionStart, SessionEnd, PreCompact, Notification

What would you like to do?
</intake>

<routing>
| Command Pattern | Workflow |
|-----------------|----------|
| `new <event> <name>` | workflows/create-hook.md |
| `template <type>` | Show template from templates/ |
| `add-to-settings` | workflows/add-to-settings.md |
| `list` | Read .claude/settings.json and list hooks |
</routing>

<quick_reference>
**Hook Events:**
| Event | When | Matcher? | Can Block? |
|-------|------|----------|------------|
| PreToolUse | Before tool runs | Yes (tool name) | Yes |
| PostToolUse | After tool succeeds | Yes (tool name) | Feedback only |
| PermissionRequest | Permission dialog shown | Yes (tool name) | Yes |
| UserPromptSubmit | User sends prompt | No | Yes |
| Stop | Claude finishes responding | No | Yes (continue) |
| SubagentStop | Subagent finishes | No | Yes (continue) |
| SessionStart | Session begins | Yes (startup/resume/clear/compact) | Context injection |
| SessionEnd | Session ends | No | Cleanup only |
| PreCompact | Before context compaction | Yes (manual/auto) | No |
| Notification | System notification | Yes (type) | No |

**Common Matchers:**
- `Write|Edit|MultiEdit` - File modifications
- `Bash` - Shell commands
- `Task` - Subagent creation
- `mcp__*` - MCP server tools
- `*` or empty - All tools
</quick_reference>

<output_patterns>
**Exit Codes:**
```bash
exit 0    # Success (stdout shown in verbose mode)
exit 2    # Block action (stderr shown to Claude)
exit 1    # Non-blocking error (logged only)
```

**JSON Output (exit 0):**
```json
{
  "decision": "block",
  "reason": "Why Claude should stop/retry",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Shown to user"
  }
}
```

**PreToolUse Decisions:** `allow` (bypass permission), `deny` (block), `ask` (show dialog)
**Stop/SubagentStop Decisions:** `block` (continue working) with required `reason`
</output_patterns>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/hook-events.md | Full input/output schemas per event |
| references/json-output.md | JSON response format details |
</references_index>

<templates_index>
| Template | Use Case |
|----------|----------|
| templates/bash-validator.sh | Validate tool inputs (e.g., block dangerous commands) |
| templates/python-validator.py | Complex validation with JSON parsing |
| templates/auto-approve.py | Auto-approve safe operations |
| templates/context-injection.py | Add context on SessionStart/UserPromptSubmit |
| templates/stop-gate.py | Ensure work is complete before stopping |
</templates_index>

<success_criteria>
- [ ] Hook script created with proper shebang and permissions
- [ ] Settings.json updated with hook configuration
- [ ] Input parsing handles JSON from stdin
- [ ] Output uses correct exit codes/JSON format
- [ ] Script tested manually before relying on it
</success_criteria>
