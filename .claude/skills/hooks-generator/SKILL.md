---
name: hooks-generator
description: Quickly spin up Claude Code hooks for automation. Generates bash scripts, Python handlers, and settings.json configuration for PreToolUse, PostToolUse, SessionStart, Stop, and other hook events.
invocation: user
context_budget:
  skill_md: 250
  max_references: 3
---

<objective>
Generate Claude Code hooks quickly with proper configuration, input handling, and output formatting. Analyzes existing hooks to prevent conflicts. Takes care of boilerplate so you focus on logic.
</objective>

<essential_principles>
1. **Analyze first** - Before creating, understand existing hooks to prevent conflicts
2. **Settings location** - User (`~/.claude/settings.json`), project (`.claude/settings.json`), or local (`.claude/settings.local.json`)
3. **Input via stdin** - Hooks receive JSON with session_id, tool_name, tool_input, etc.
4. **Output via exit codes** - 0=success, 2=blocking error (stderr shown to Claude)
5. **Parallel execution** - All matching hooks run simultaneously (60s timeout default)
6. **Test before deploy** - Run hooks manually before adding to settings
</essential_principles>

<intake>
**Commands:**
1. `/hooks new <event> <name>` - Create a new hook (spawns analysis agents first)
2. `/hooks analyze` - Inventory existing hooks and identify gaps
3. `/hooks template <type>` - Show a template (validation, auto-approve, context-injection, stop-gate)
4. `/hooks add-to-settings` - Add hook to settings.json
5. `/hooks test <script>` - Test a hook with sample inputs
6. `/hooks debug` - Troubleshooting guide for broken hooks

**Event types:** PreToolUse, PostToolUse, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, SessionStart, SessionEnd, PreCompact, Notification

What would you like to do?
</intake>

<routing>
| Command Pattern | Action |
|-----------------|--------|
| `new <event> <name>` | 1. Spawn hook_inventory_agent → 2. Spawn interaction_analyzer_agent → 3. workflows/create-hook.md → 4. Spawn hook_tester_agent |
| `analyze` | Spawn hook_inventory_agent, report findings |
| `template <type>` | Show template from templates/ |
| `add-to-settings` | workflows/add-to-settings.md |
| `test <script>` | Spawn hook_tester_agent |
| `debug` | Load references/debugging.md |
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
| SessionStart | Session begins | Yes (startup/resume/clear/compact) | Context + env vars |
| SessionEnd | Session ends | No | Cleanup only |
| PreCompact | Before context compaction | Yes (manual/auto) | No |
| Notification | System notification | Yes (type) | No |

**Common Matchers:**
- `Write|Edit|MultiEdit` - File modifications
- `Bash` - Shell commands
- `Task` - Subagent creation
- `Read|Glob|Grep` - File reading/search
- `mcp__<server>__<tool>` - MCP tools (e.g., `mcp__github__.*`)
- `*` or empty - All tools

**MCP Tool Pattern:** `mcp__<server>__<tool>`
- `mcp__memory__create_entities`
- `mcp__github__search_repositories`
- `mcp__gmail-autoauth__send_email`
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
**SessionStart:** Can set env vars via `CLAUDE_ENV_FILE` (see references/session-env-vars.md)
</output_patterns>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/hook-events.md | Full input/output schemas per event |
| references/json-output.md | JSON response format details |
| references/mcp-and-security.md | MCP tool hooks + security best practices |
| references/session-env-vars.md | Environment variable persistence (SessionStart) |
| references/debugging.md | Troubleshooting, testing, healing broken hooks |
| references/sub-agents.md | Agent definitions for hook analysis |
</references_index>

<templates_index>
| Template | Use Case |
|----------|----------|
| templates/bash-validator.sh | Validate tool inputs (e.g., block dangerous commands) |
| templates/python-validator.py | Complex validation with JSON parsing |
| templates/auto-approve.py | Auto-approve safe operations |
| templates/context-injection.py | Add context on SessionStart/UserPromptSubmit |
| templates/stop-gate.py | Ensure work is complete before stopping |
| templates/notification-forwarder.sh | Forward notifications to external systems |
</templates_index>

<subagent_usage>
**When creating hooks, spawn agents in this order:**

1. **hook_inventory_agent** (always first)
   - Scans .claude/settings.json and .claude/hooks/
   - Returns inventory of all existing hooks
   - Identifies gaps in coverage

2. **interaction_analyzer_agent** (before creating)
   - Takes inventory + proposed hook details
   - Identifies conflicts with existing hooks
   - Recommends modifications to avoid issues

3. **hook_tester_agent** (after creating)
   - Generates test cases for the new hook
   - Runs hook with test inputs
   - Reports pass/fail with specific fixes

See `references/sub-agents.md` for full prompt templates.
</subagent_usage>

<success_criteria>
- [ ] Existing hooks analyzed (no surprise conflicts)
- [ ] Hook script created with proper shebang and permissions
- [ ] Settings.json updated with hook configuration
- [ ] Input parsing handles JSON from stdin
- [ ] Output uses correct exit codes/JSON format
- [ ] Script tested with multiple inputs before deployment
- [ ] Security: inputs validated, paths sanitized, sensitive files protected
</success_criteria>
