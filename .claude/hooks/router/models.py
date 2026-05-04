"""Type definitions for the hook router framework."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Decision(Enum):
    """Hook decision: NONE (no opinion), APPROVE, ASK (user prompt), or BLOCK."""
    NONE = "none"
    APPROVE = "approve"
    ASK = "ask"
    BLOCK = "block"


@dataclass
class HandlerResult:
    """Result from a single handler invocation.

    Attributes:
        decision: NONE (default), APPROVE, or BLOCK
        reason: Human-readable reason (used with BLOCK/APPROVE)
        additional_context: Text injected into agent context
        stderr_message: Text printed to stderr (visible in terminal)
        exit_code: 0 = success, 2 = block tool
        suppress_further: If True, skip remaining handlers
    """
    decision: Decision = Decision.NONE
    reason: str = ""
    additional_context: str = ""
    stderr_message: str = ""
    exit_code: int = 0
    suppress_further: bool = False


@dataclass
class HandlerConfig:
    """Configuration for a handler within a router.

    Attributes:
        fn: The handler function (input_data: dict) -> HandlerResult | None
        matcher: Optional regex pattern to match against tool_name or event matcher.
                 If None, handler always runs.
        name: Human-readable name for logging
    """
    fn: object  # Callable[[dict], Optional[HandlerResult]]
    matcher: Optional[str] = None
    name: str = ""
