"""Consolidated memory recall: semantic + CASS memory in one handler.

Replaces three separate hooks:
- semantic-memory-recall.py (UserPromptSubmit)
- cm-context-recall.py (UserPromptSubmit)
- thinking-memory-recall.py (PreToolUse) — REMOVED entirely
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult

TRIVIAL_MESSAGES = {
    "yes", "no", "sure", "ok", "okay", "thanks", "thank you",
    "do it", "go ahead", "sounds good", "lgtm", "ship it",
    "yes please", "no thanks", "continue", "proceed",
}


def unified_memory_recall(input_data: dict) -> HandlerResult:
    """UserPromptSubmit: combined semantic + CASS memory recall.

    One function call per user message instead of 3 separate processes.
    """
    prompt = input_data.get("prompt", "")

    if not prompt or len(prompt.strip()) < 20:
        return None

    if prompt.strip().lower().rstrip("!.?") in TRIVIAL_MESSAGES:
        return None

    parts = []

    # 1. Semantic memory via qmd
    semantic = _query_semantic(prompt)
    if semantic:
        parts.append(semantic)

    # 2. CASS memory via cm
    cass = _query_cass(prompt)
    if cass:
        parts.append(cass)

    if not parts:
        return None

    context = "\n\n".join(parts)

    # Show CASS rules to terminal
    if cass:
        import sys
        print(cass, file=sys.stderr)

    return HandlerResult(additional_context=context)


def _query_semantic(prompt: str) -> str:
    """Query qmd for semantic similarity search."""
    if not shutil.which("qmd"):
        # Fallback to keyword search
        return _keyword_fallback(prompt)

    query_text = prompt[-1500:]

    try:
        result = subprocess.run(
            ["qmd", "vsearch", query_text, "--collection", "memories", "--limit", "3", "--json"],
            capture_output=True,
            text=True,
            timeout=3,
        )

        if result.returncode != 0:
            return _keyword_fallback(prompt)

        memories = json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return _keyword_fallback(prompt)

    memories = [m for m in memories if m.get("score", 0) >= 0.35]

    if not memories:
        return ""

    scores = [m.get("score", 0) for m in memories]
    header = f"Recalled {len(memories)} memories | similarity: {min(scores):.2f}-{max(scores):.2f}"
    lines = [_format_memory(m) for m in memories]
    return header + "\n" + "\n".join(f"  {line}" for line in lines)


def _keyword_fallback(prompt: str) -> str:
    """Fallback keyword search when qmd unavailable."""
    cwd = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    memories_dir = Path(cwd) / "brain" / "memories"

    if not memories_dir.exists():
        return ""

    query_words = set(word.lower() for word in prompt.split() if len(word) > 3)
    results = []

    for memory_file in memories_dir.rglob("*.md"):
        try:
            content = memory_file.read_text()
            content_lower = content.lower()
            matches = sum(1 for word in query_words if word in content_lower)
            if matches > 0:
                score = min(matches / max(len(query_words), 1), 0.95)
                results.append({"path": str(memory_file), "content": content, "score": score})
        except (PermissionError, UnicodeDecodeError):
            continue

    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:3]
    results = [m for m in results if m.get("score", 0) >= 0.35]

    if not results:
        return ""

    scores = [m["score"] for m in results]
    header = f"Recalled {len(results)} memories | similarity: {min(scores):.2f}-{max(scores):.2f}"
    lines = [_format_memory(m) for m in results]
    return header + "\n" + "\n".join(f"  {line}" for line in lines)


def _format_memory(memory: dict) -> str:
    """Format a single memory for display."""
    file_path = memory.get("path", "")
    similarity = memory.get("score", 0)

    if "/gotchas/" in file_path:
        mem_type = "GOTCHA"
    elif "/patterns/" in file_path:
        mem_type = "PATTERN"
    elif "/solutions/" in file_path:
        mem_type = "WORKING_SOLUTION"
    else:
        mem_type = "MEMORY"

    raw_content = memory.get("content", "")
    content = raw_content.strip()
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            content = parts[2].strip()
    first_line = content.split("\n")[0].strip()
    if len(first_line) > 100:
        first_line = first_line[:100] + "..."

    return f"[{mem_type}] ({similarity:.2f}): {first_line}"


def _query_cass(prompt: str) -> str:
    """Query CASS Memory (cm) for relevant playbook rules."""
    if not shutil.which("cm"):
        return ""

    query_text = prompt[-500:]

    try:
        result = subprocess.run(
            ["cm", "context", query_text, "--json"],
            capture_output=True,
            text=True,
            timeout=3,
        )

        if result.returncode != 0:
            return ""

        data = json.loads(result.stdout)
        bullets = data.get("data", {}).get("relevantBullets", [])
        bullets = bullets[:5]
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return ""

    # Filter by relevance score
    bullets = [r for r in bullets if r.get("relevanceScore", 0) >= 4]

    if not bullets:
        return ""

    lines = []
    for r in bullets:
        cat = r.get("category", "general")
        content = r.get("content", "")
        lines.append(f"[{cat}] {content}")

    return f"CASS Memory ({len(lines)} rules matched):\n" + "\n".join(f"  - {l}" for l in lines)
