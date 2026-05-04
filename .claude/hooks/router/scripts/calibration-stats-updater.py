#!/usr/bin/env python3
"""
PostToolUse hook: Auto-update stats.yaml after calibration output is written.

Triggers on: Write to brain/outputs/calibrations/*.md
Actions:
1. Move applied traces to brain/traces/processed/
2. Count total processed traces
3. Update .claude/stats.yaml
4. Git commit the archive
5. Print evolution banner
"""

import json
import os
import sys
import glob
import re
import shutil
import subprocess
from datetime import date

def count_all_processed_traces():
    """Count all traces (active applied + already processed)"""
    # Count in processed folder
    processed = glob.glob("brain/traces/processed/*.md")

    # Count applied in active folder (about to be moved)
    active_applied = 0
    for f in glob.glob("brain/traces/*.md"):
        try:
            with open(f, 'r') as file:
                if 'review_status: applied' in file.read(500):
                    active_applied += 1
        except:
            pass

    return len(processed) + active_applied

def archive_applied_traces():
    """Move applied traces to brain/traces/processed/"""
    archive_dir = "brain/traces/processed"
    os.makedirs(archive_dir, exist_ok=True)

    moved = []
    for f in glob.glob("brain/traces/*.md"):
        try:
            with open(f, 'r') as file:
                if 'review_status: applied' in file.read(500):
                    filename = os.path.basename(f)
                    dest = os.path.join(archive_dir, filename)
                    shutil.move(f, dest)
                    moved.append(filename)
        except:
            pass

    return moved

def bump_version():
    """Increment patch version in VERSION file"""
    version_path = "VERSION"
    try:
        with open(version_path, 'r') as f:
            version = f.read().strip()

        parts = version.split('.')
        parts[-1] = str(int(parts[-1]) + 1)
        new_version = '.'.join(parts)

        with open(version_path, 'w') as f:
            f.write(new_version + '\n')

        return version, new_version
    except:
        return None, None

def git_stage_all():
    """Stage traces, stats, and version for commit"""
    try:
        subprocess.run(["git", "add", "brain/traces/"], check=True, capture_output=True)
        subprocess.run(["git", "add", ".claude/stats.yaml"], check=True, capture_output=True)
        subprocess.run(["git", "add", "VERSION"], check=True, capture_output=True)
        subprocess.run(["git", "add", "brain/outputs/calibrations/"], check=True, capture_output=True)
    except:
        pass

def get_level_info(traces):
    """Return level number, title, icon, and progress info"""
    thresholds = [
        (0, 100, 1, "SEED", "🌱", "SPROUT"),
        (100, 500, 2, "SPROUT", "🌿", "SAPLING"),
        (500, 1000, 3, "SAPLING", "🌳", "TREE"),
        (1000, 2500, 4, "TREE", "🌲", "FOREST"),
        (2500, float('inf'), 5, "FOREST", "🌲🌲🌲", None),
    ]

    for min_t, max_t, level, title, icon, next_title in thresholds:
        if min_t <= traces < max_t:
            progress = traces - min_t
            needed = max_t - min_t if max_t != float('inf') else 0
            return {
                'level': level,
                'title': title,
                'icon': icon,
                'current': traces,
                'next_threshold': max_t if max_t != float('inf') else None,
                'next_title': next_title,
                'progress': progress,
                'needed': needed
            }

    return {'level': 5, 'title': 'FOREST', 'icon': '🌲🌲🌲', 'current': traces}

def update_stats(traces):
    """Update .claude/stats.yaml"""
    stats_path = ".claude/stats.yaml"

    # Read existing to get calibration count
    calibrations = 1
    try:
        with open(stats_path, 'r') as f:
            content = f.read()
            match = re.search(r'total_calibrations:\s*(\d+)', content)
            if match:
                calibrations = int(match.group(1)) + 1
    except:
        pass

    stats_content = f"""# Personal OS Statistics
# Updated automatically by calibration-stats-updater hook

total_traces_processed: {traces}
total_calibrations: {calibrations}
last_calibration: {date.today().isoformat()}

# Level thresholds (decision traces)
# Level 1: 0-99 (Seed)
# Level 2: 100-499 (Sprout)
# Level 3: 500-999 (Sapling)
# Level 4: 1000-2499 (Tree)
# Level 5: 2500+ (Forest)
"""

    with open(stats_path, 'w') as f:
        f.write(stats_content)

    return calibrations

def make_progress_bar(current, threshold, width=20):
    """Create progress bar string"""
    if threshold is None:
        return "█" * width  # Max level

    progress = min(current / threshold, 1.0)
    filled = int(progress * width)
    empty = width - filled
    return "█" * filled + "░" * empty

def main():
    hook_input = json.loads(sys.stdin.read())

    tool_name = hook_input.get('tool_name', '')
    tool_input = hook_input.get('tool_input', {})

    # Only trigger on Write tool
    if tool_name != 'Write':
        return

    file_path = tool_input.get('file_path', '')

    # Only trigger for calibration outputs
    if 'brain/outputs/calibrations/' not in file_path or not file_path.endswith('.md'):
        return

    # Skip if file already has commit SHA (this is the post-commit update)
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        if 'git revert' in content.lower():
            return
    except:
        pass

    # Count traces, archive them, update stats, bump version, stage for commit
    traces = count_all_processed_traces()
    moved = archive_applied_traces()
    calibrations = update_stats(traces)
    old_version, new_version = bump_version()
    git_stage_all()
    level_info = get_level_info(traces)

    # Build progress bar
    if level_info.get('next_threshold'):
        bar = make_progress_bar(level_info['progress'], level_info['needed'])
        progress_line = f"[{bar}] {traces}/{level_info['next_threshold']} traces to {level_info['next_title']}"
    else:
        bar = make_progress_bar(1, 1)
        progress_line = f"[{bar}] MAX LEVEL - {traces} traces processed"

    # Build summary for AI with explicit next steps
    summary_parts = [
        f"CALIBRATION HOOK COMPLETED",
        f"",
        f"Version: {old_version} -> {new_version}",
        f"Stats: {traces} traces, {calibrations} calibrations, Level {level_info['level']} {level_info['title']}",
    ]
    if moved:
        summary_parts.append(f"Archived: {len(moved)} traces moved to brain/traces/processed/")

    summary_parts.extend([
        f"",
        f"NEXT STEPS (do these now):",
        f"1. Run /commit to create the calibration commit",
        f"2. After commit, edit this calibration file to add: To undo: git revert <SHA>",
        f"   (The SHA comes from the commit you just made)",
    ])

    # Return JSON for AI to see
    result = {
        "message": "\n".join(summary_parts)
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
