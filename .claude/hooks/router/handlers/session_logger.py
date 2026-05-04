"""Session logger: records session activity to daily note via git stats.

Hooks into SessionStart (record start state) and Stop/PreCompact (append log
entry to daily note before auto-commit stages it). Single commit, no loops.

All git operations fail gracefully — no env vars or config required.
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

try:
    from ..models import HandlerResult
except ImportError:
    from models import HandlerResult


# --- Area classification (mirrors git-smart-stage.sh build_commit_msg) ---

AREA_MAP = [
    ("brain/notes/daily/", "daily notes"),
    ("brain/notes/weekly/", "weekly notes"),
    ("brain/notes/", "notes"),
    ("brain/entities/", "entities"),
    ("brain/calls/", "calls"),
    ("brain/outputs/", "outputs"),
    ("brain/traces/", "traces"),
    ("brain/library/", "library"),
    ("brain/templates/", "templates"),
    ("brain/context/", "context"),
    ("brain/inbox/", "inbox"),
    ("brain/", "brain"),
    ("schemas/", "schemas"),
    (".claude/", "claude config"),
    (".beads/", "beads"),
    ("services/", "services"),
    ("plans/", "plans"),
    ("scripts/", "scripts"),
]

# Files the logger itself touches — exclude from the change list
_SELF_PATHS = {".claude/state/session-log.json"}

# Directory segments that are always noise — never list individual files from these
_NOISE_DIRS = ("node_modules/", "__pycache__/", ".venv/", "vendor/", ".tox/", "dist/")

# Max files to list individually before truncating
_MAX_FILE_LIST = 20


def _project_dir() -> str:
    return os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())


def _state_path() -> Path:
    return Path(_project_dir()) / ".claude" / "state" / "session-log.json"


def _daily_note_path(date_str: str | None = None) -> Path | None:
    """Find today's daily note. Returns None if it doesn't exist."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    path = Path(_project_dir()) / "brain" / "notes" / "daily" / f"{date_str}.md"
    return path if path.exists() else None


def _load_state() -> dict:
    path = _state_path()
    if path.exists():
        try:
            data = json.loads(path.read_text())
            # Clear logged_sessions on date change
            if data.get("date") != datetime.now().strftime("%Y-%m-%d"):
                data["logged_sessions"] = []
                data["date"] = datetime.now().strftime("%Y-%m-%d")
            return data
        except (json.JSONDecodeError, Exception):
            pass
    return {"logged_sessions": [], "date": datetime.now().strftime("%Y-%m-%d")}


def _save_state(state: dict):
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n")


def _git(*args: str, timeout: int = 5) -> str | None:
    """Run a git command, return stdout or None on failure."""
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=_project_dir(),
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def _get_head_commit() -> str | None:
    return _git("rev-parse", "--short", "HEAD")


def _is_noise(path: str) -> bool:
    """Check if a file path is in a noise directory (node_modules, etc.)."""
    return any(seg in path for seg in _NOISE_DIRS)


def _get_session_changes(
    start_commit: str | None, daily_note_rel: str | None = None
) -> dict:
    """Get all session changes: tracked diffs + untracked new files.

    Returns {
        'files': [(status, path), ...],  # status: 'new', 'modified', 'deleted', 'renamed'
        'insertions': int,
        'deletions': int,
    }
    """
    STATUS_LABELS = {"A": "new", "D": "deleted", "R": "renamed", "C": "copied"}
    exclude = set(_SELF_PATHS)
    if daily_note_rel:
        exclude.add(daily_note_rel)

    result: dict = {"files": [], "insertions": 0, "deletions": 0}
    seen_paths: set[str] = set()

    # 1. Tracked changes (committed + uncommitted modifications to tracked files)
    for ref in filter(None, [start_commit, "HEAD"]):
        # Get file statuses
        ns_output = _git("diff", "--name-status", ref, timeout=10)
        if ns_output is None:
            continue

        for line in ns_output.split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2:
                status_char = parts[0][0]  # M, A, D, R, C
                path = parts[-1]  # last element handles renames
                if path in exclude or _is_noise(path):
                    continue
                seen_paths.add(path)
                label = STATUS_LABELS.get(status_char, "modified")
                result["files"].append((label, path))

        # Get insertion/deletion counts
        num_output = _git("diff", "--numstat", ref, timeout=10)
        if num_output:
            for line in num_output.split("\n"):
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 3:
                    path = parts[2]
                    if path in exclude or _is_noise(path):
                        continue
                    try:
                        result["insertions"] += int(parts[0])
                    except ValueError:
                        pass
                    try:
                        result["deletions"] += int(parts[1])
                    except ValueError:
                        pass
        break  # succeeded with this ref, don't try fallback

    # 2. Untracked new files (not yet staged)
    ut_output = _git("ls-files", "--others", "--exclude-standard")
    if ut_output:
        for path in ut_output.split("\n"):
            if path and path not in exclude and path not in seen_paths and not _is_noise(path):
                seen_paths.add(path)
                result["files"].append(("new", path))

    return result


def _classify_areas(file_paths: list[str]) -> list[str]:
    """Map file paths to human-readable area names."""
    areas: set[str] = set()
    for path in file_paths:
        matched = False
        for prefix, area in AREA_MAP:
            if path.startswith(prefix):
                areas.add(area)
                matched = True
                break
        if not matched:
            areas.add("vault")
    return sorted(areas)


def _format_file_list(files: list[tuple[str, str]]) -> list[str]:
    """Format file changes as bullet points.

    Modified files have no annotation (it's the default).
    New/deleted/renamed files get a parenthetical label.
    """
    lines = []
    for status, path in files[:_MAX_FILE_LIST]:
        if status == "modified":
            lines.append(f"- `{path}`")
        else:
            lines.append(f"- `{path}` ({status})")

    overflow = len(files) - _MAX_FILE_LIST
    if overflow > 0:
        lines.append(f"- *...and {overflow} more*")

    return lines


def _format_stats_line(
    total_files: int, insertions: int, deletions: int, areas: list[str]
) -> str:
    """Format the backtick stats line for the daily note."""
    if total_files == 0:
        return "`0 files changed · (no changes)`"

    count = f"{total_files} file{'s' if total_files != 1 else ''} changed"
    if insertions or deletions:
        count += f" (+{insertions} -{deletions})"

    if areas:
        return f"`{count} · {', '.join(areas)}`"
    return f"`{count}`"


# --- Handlers ---


def session_log_start(input_data: dict) -> HandlerResult:
    """SessionStart: record start time and current HEAD for later diffing."""
    try:
        head = _get_head_commit()
        now = datetime.now()

        state = _load_state()
        state["session_id"] = f"{now.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}"
        state["start_time"] = now.isoformat()
        state["start_commit"] = head
        state["date"] = now.strftime("%Y-%m-%d")
        _save_state(state)

        return HandlerResult(
            stderr_message=f"[session-log] Tracking from {head or 'no-git'}"
        )
    except Exception as e:
        return HandlerResult(stderr_message=f"[session-log] Start failed: {e}")


def log_session_summary(input_data: dict) -> HandlerResult:
    """Stop/PreCompact: append session stats to today's daily note.

    Runs BEFORE git_auto_commit_stop so the updated daily note gets
    included in the same commit. Single commit, no loop.
    """
    try:
        state = _load_state()
        session_id = state.get("session_id")

        # Dedup: already logged this session?
        if session_id and session_id in state.get("logged_sessions", []):
            return HandlerResult(
                stderr_message="[session-log] Already logged, skipping"
            )

        # Must have a daily note to write to
        log_date = state.get("date", datetime.now().strftime("%Y-%m-%d"))
        daily_note = _daily_note_path(log_date)
        if not daily_note:
            return HandlerResult(
                stderr_message="[session-log] No daily note, skipping"
            )

        # Relative path of the daily note (to exclude from change list)
        try:
            daily_note_rel = str(daily_note.relative_to(_project_dir()))
        except ValueError:
            daily_note_rel = None

        # Gather session changes
        start_commit = state.get("start_commit")
        changes = _get_session_changes(start_commit, daily_note_rel)
        all_paths = [path for _, path in changes["files"]]

        # Skip if truly nothing happened
        current_head = _get_head_commit()
        if not changes["files"] and current_head == start_commit:
            return HandlerResult(
                stderr_message="[session-log] No changes, skipping"
            )

        # Build time range
        start_time = state.get("start_time")
        if start_time:
            try:
                start_str = datetime.fromisoformat(start_time).strftime("%H:%M")
            except ValueError:
                start_str = "??:??"
        else:
            start_str = "??:??"
        end_str = datetime.now().strftime("%H:%M")

        # Build file list and stats
        file_lines = _format_file_list(changes["files"])
        areas = _classify_areas(all_paths)
        stats_line = _format_stats_line(
            len(changes["files"]),
            changes["insertions"],
            changes["deletions"],
            areas,
        )

        # Assemble entry
        entry_lines = [f"### {start_str} — {end_str}", ""]
        if file_lines:
            entry_lines.extend(file_lines)
            entry_lines.append("")
        entry_lines.extend([stats_line, ""])

        # Read daily note and append
        content = daily_note.read_text()

        if "## Session Log" in content:
            log_pos = content.index("## Session Log")
            after_header = content[log_pos + len("## Session Log") :]
            has_entries = "###" in after_header

            if has_entries:
                entry = "\n---\n\n" + "\n".join(entry_lines)
            else:
                entry = "\n" + "\n".join(entry_lines)

            content = content.rstrip("\n") + "\n" + entry
        else:
            section = "\n## Session Log\n\n" + "\n".join(entry_lines)
            content = content.rstrip("\n") + "\n" + section

        daily_note.write_text(content)

        # Mark logged
        if session_id:
            state.setdefault("logged_sessions", []).append(session_id)
            _save_state(state)

        total = len(changes["files"])
        return HandlerResult(
            stderr_message=f"[session-log] {total} files, {start_str}–{end_str}"
        )

    except Exception as e:
        # Never block the commit pipeline
        return HandlerResult(stderr_message=f"[session-log] Failed: {e}")
