from __future__ import annotations

"""Core router framework: parse stdin, dispatch handlers, combine outputs.

Each event gets a single router script that:
1. Reads JSON from stdin once
2. Dispatches to handler functions in-process
3. Combines results following priority rules
4. Outputs combined JSON to stdout, errors to stderr
"""

import json
import re
import sys
import traceback
from typing import Optional

try:
    from .models import Decision, HandlerConfig, HandlerResult
except ImportError:
    from models import Decision, HandlerConfig, HandlerResult


def parse_stdin() -> dict:
    """Read and parse JSON from stdin. Returns empty dict on failure."""
    try:
        return json.loads(sys.stdin.read())
    except (json.JSONDecodeError, Exception):
        return {}


def matches(handler: HandlerConfig, input_data: dict) -> bool:
    """Check if a handler's matcher applies to this input.

    For PreToolUse/PostToolUse: matches against tool_name
    For SessionStart: matches against matcher field (startup/compact/clear)
    For other events: always True if no matcher set
    """
    if handler.matcher is None:
        return True

    # Try tool_name first (PreToolUse, PostToolUse)
    tool_name = input_data.get("tool_name", "")
    if tool_name and re.search(handler.matcher, tool_name):
        return True

    # Try event matcher (SessionStart matcher field)
    event_matcher = input_data.get("matcher", "")
    if event_matcher and re.search(handler.matcher, event_matcher):
        return True

    return False


def run_handler(handler: HandlerConfig, input_data: dict) -> Optional[HandlerResult]:
    """Run a single handler, catching exceptions."""
    try:
        result = handler.fn(input_data)
        return result
    except Exception as e:
        name = handler.name or handler.fn.__name__
        tb = traceback.format_exc()
        sys.stderr.write(f"[router] handler {name} failed: {e}\n{tb}\n")
        return None


def combine_results(results: list[HandlerResult]) -> HandlerResult:
    """Combine multiple handler results into one.

    Rules:
    - decision: BLOCK > APPROVE > NONE
    - additional_context: concatenated with separator
    - stderr_message: concatenated with newlines
    - exit_code: max of all
    - reason: from highest-priority decision
    """
    if not results:
        return HandlerResult()

    combined = HandlerResult()

    contexts = []
    stderr_parts = []
    reasons = []

    for r in results:
        # Decision priority: BLOCK > ASK > APPROVE > NONE
        if r.decision == Decision.BLOCK:
            combined.decision = Decision.BLOCK
        elif r.decision == Decision.ASK and combined.decision not in (Decision.BLOCK,):
            combined.decision = Decision.ASK
        elif r.decision == Decision.APPROVE and combined.decision not in (Decision.BLOCK, Decision.ASK):
            combined.decision = Decision.APPROVE

        if r.reason:
            reasons.append((r.decision, r.reason))

        if r.additional_context:
            contexts.append(r.additional_context)

        if r.stderr_message:
            stderr_parts.append(r.stderr_message)

        combined.exit_code = max(combined.exit_code, r.exit_code)

    # Use reason from highest-priority decision
    if reasons:
        # Sort by decision priority (BLOCK first)
        priority = {Decision.BLOCK: 0, Decision.ASK: 1, Decision.APPROVE: 2, Decision.NONE: 3}
        reasons.sort(key=lambda x: priority.get(x[0], 2))
        combined.reason = reasons[0][1]

    if contexts:
        combined.additional_context = "\n\n---\n\n".join(contexts)

    if stderr_parts:
        combined.stderr_message = "\n".join(stderr_parts)

    return combined


def format_output(result: HandlerResult, event_name: str) -> Optional[str]:
    """Format a HandlerResult as JSON for stdout.

    Different events use different output formats:
    - PreToolUse: hookSpecificOutput with permissionDecision
    - UserPromptSubmit: hookSpecificOutput with additionalContext
    - SessionStart: additionalContext at top level
    - Stop/PreCompact: decision/reason at top level
    - PostToolUse: message at top level
    """
    output = {}

    if event_name in ("PreToolUse",):
        # PreToolUse uses hookSpecificOutput format
        hook_output = {"hookEventName": event_name}

        if result.decision == Decision.BLOCK:
            hook_output["permissionDecision"] = "deny"
            hook_output["permissionDecisionReason"] = result.reason
        elif result.decision == Decision.ASK:
            hook_output["permissionDecision"] = "ask"
            hook_output["permissionDecisionReason"] = result.reason
        elif result.decision == Decision.APPROVE:
            hook_output["permissionDecision"] = "allow"
            if result.reason:
                hook_output["permissionDecisionReason"] = result.reason

        if result.additional_context:
            hook_output["additionalContext"] = result.additional_context

        if hook_output.get("permissionDecision") or hook_output.get("additionalContext"):
            output["hookSpecificOutput"] = hook_output

    elif event_name in ("UserPromptSubmit",):
        # UserPromptSubmit uses hookSpecificOutput for context injection
        if result.additional_context:
            output["hookSpecificOutput"] = {
                "hookEventName": event_name,
                "additionalContext": result.additional_context,
            }

    elif event_name in ("SessionStart", "PreCompact"):
        # These use top-level additionalContext
        if result.additional_context:
            output["additionalContext"] = result.additional_context

    elif event_name in ("Stop",):
        # Stop uses decision/reason format
        if result.decision == Decision.BLOCK:
            output["decision"] = "block"
            output["reason"] = result.reason
        elif result.decision == Decision.APPROVE:
            output["decision"] = "approve"

    elif event_name in ("PostToolUse",):
        # PostToolUse uses message format
        if result.additional_context:
            output["message"] = result.additional_context

    # Fallback: if we have a block decision but no formatted output yet
    if result.decision == Decision.BLOCK and not output:
        output = {"decision": "block", "reason": result.reason}

    return json.dumps(output) if output else None


def dispatch(handlers: list[HandlerConfig], event_name: str):
    """Main dispatch loop. Called by each event's entry point.

    1. Parse stdin once
    2. Filter handlers by matcher
    3. Run matching handlers in order
    4. Combine results
    5. Output to stdout/stderr
    6. Exit with appropriate code
    """
    input_data = parse_stdin()

    results = []

    for handler in handlers:
        if not matches(handler, input_data):
            continue

        result = run_handler(handler, input_data)
        if result is None:
            continue

        results.append(result)

        if result.suppress_further:
            break

    if not results:
        sys.exit(0)

    combined = combine_results(results)

    # Write stderr messages
    if combined.stderr_message:
        sys.stderr.write(combined.stderr_message)
        if not combined.stderr_message.endswith("\n"):
            sys.stderr.write("\n")

    # Write stdout JSON
    output = format_output(combined, event_name)
    if output:
        print(output)

    sys.exit(combined.exit_code)
