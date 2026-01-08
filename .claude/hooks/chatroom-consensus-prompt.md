# Chatroom Consensus Prompt Hook

This is a prompt-based SubagentStop hook for intelligent chatroom evaluation.
Use this when you want LLM-powered decision making about coordination status.

## Configuration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "You are evaluating whether a subagent should be allowed to stop.\n\n## CONTEXT\n\nCHATROOM CONTENT (if exists):\n$(cat brain/traces/agents/$(date +%Y-%m-%d)*.md 2>/dev/null | grep -v '^---' | tail -50)\n\nCURRENT TIME: $(date +%H:%M)\n\n## COORDINATION SIGNALS\n\nThese explicit signals indicate agent status:\n- → READY = Agent completed work, no blockers\n- → WAITING @agent = Agent blocked on specific agent\n- → BLOCKED: reason = Agent hit external blocker\n- → CLOSE = Orchestrator signals all agents may stop\n\n## YOUR TASK\n\nEvaluate the chatroom and determine if this subagent should be allowed to stop.\n\nConsider:\n1. Is there a → CLOSE signal? (If yes: allow stop)\n2. Are other agents posting → WAITING signals? (If yes: check if resolved)\n3. Has the orchestrator indicated synthesis is complete?\n4. Are there unresolved blockers?\n5. Has this agent contributed meaningfully to the chatroom?\n\n## IMPORTANT\n\nIf you decide to BLOCK:\n- Explain what the agent should do next\n- Suggest they wait 15-60 seconds if just waiting on other agents\n- Tell them to read the chatroom for context\n- Remind them to post → READY when done, or → WAITING @agent if blocked\n\nIf there is NO chatroom content, allow the stop.\n\n## RESPONSE FORMAT\n\nReturn ONLY valid JSON:\n{\"decision\": \"approve\" or \"block\", \"reason\": \"brief explanation of what agent should do\"}"
          }
        ]
      }
    ]
  }
}
```

## When to Use

- **Use prompt-based** when you want intelligent context-aware decisions
- **Use command-based** (chatroom-consensus-gate.py) when you want faster, deterministic behavior
- **Use both** for belt-and-suspenders (command handles escape conditions, prompt handles evaluation)

## Trade-offs

| Approach | Speed | Intelligence | Reliability |
|----------|-------|--------------|-------------|
| Command only | Fast | Pattern-matching | High (deterministic) |
| Prompt only | ~10-30s | High | Medium (LLM variance) |
| Both | ~10-30s | High | High |

## Recommended: Both Hooks

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 $CLAUDE_PROJECT_DIR/.claude/hooks/chatroom-consensus-gate.py",
            "timeout": 5
          },
          {
            "type": "prompt",
            "prompt": "... (prompt from above)"
          }
        ]
      }
    ]
  }
}
```

The command hook handles:
- Escape conditions (max retries, stop_hook_active)
- State management
- Quick pattern matching for CLOSE signal

The prompt hook handles:
- Nuanced evaluation of chatroom state
- Understanding context and intent
- Providing helpful guidance to the agent
