#!/bin/bash
# Smart git staging: stages tracked changes freely, scrutinizes new untracked files.
# Outputs staged count to stdout. Skipped files reported to stderr.
# Usage: source this file, then call smart_stage / build_commit_msg.

# Known safe directories (new files here are auto-staged)
SAFE_DIRS=(brain/ schemas/ .claude/ .agents/ .codex/ .pi/ .beads/ services/ plans/ scripts/ docs/)

# Max file size for auto-staging new files (1MB)
MAX_NEW_FILE_SIZE=1048576

# Patterns that suggest secrets
SECRET_FILENAME_PATTERNS='.env|credentials|secret|\.pem$|\.key$|\.p12$|\.pfx$|token'
SECRET_CONTENT_PATTERNS='PRIVATE KEY|api_key|apikey|secret_key|password\s*=|AWS_SECRET|sk-[a-zA-Z0-9]{20,}'

_is_safe_dir() {
    local file="$1"
    for dir in "${SAFE_DIRS[@]}"; do
        case "$file" in
            "$dir"*) return 0 ;;
        esac
    done
    return 1
}

_is_secret_filename() {
    echo "$1" | grep -qiE "$SECRET_FILENAME_PATTERNS"
}

_is_binary() {
    [ -f "$1" ] || return 1
    local filetype
    filetype=$(file "$1")
    # Only flag actual binary — not "text executable" (shell scripts, python, etc.)
    echo "$filetype" | grep -q "text" && return 1
    echo "$filetype" | grep -q "binary\|archive\|image\|video\|audio\|ELF\|Mach-O\|compiled" && return 0
    return 1
}

_has_secret_content() {
    [ -f "$1" ] && head -c 4096 "$1" 2>/dev/null | grep -qiE "$SECRET_CONTENT_PATTERNS"
}

_file_size() {
    stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo "0"
}

smart_stage() {
    local staged_count=0
    local skip_count=0

    # 1. Stage all modifications/deletions to tracked files — always safe
    local tracked_changes
    tracked_changes=$(git diff --name-only 2>/dev/null || true)
    if [ -n "$tracked_changes" ]; then
        while IFS= read -r f; do
            [ -n "$f" ] && git add -- "$f" 2>/dev/null && staged_count=$((staged_count + 1))
        done <<< "$tracked_changes"
    fi

    local deleted_files
    deleted_files=$(git ls-files --deleted 2>/dev/null || true)
    if [ -n "$deleted_files" ]; then
        while IFS= read -r f; do
            [ -n "$f" ] && git add -- "$f" 2>/dev/null && staged_count=$((staged_count + 1))
        done <<< "$deleted_files"
    fi

    # 2. Scrutinize new untracked files
    local untracked
    untracked=$(git ls-files --others --exclude-standard 2>/dev/null || true)
    [ -z "$untracked" ] && { echo "$staged_count"; return 0; }

    while IFS= read -r file; do
        [ -z "$file" ] && continue

        # Safe directory?
        if ! _is_safe_dir "$file"; then
            echo "  SKIP: $file (outside known directories)" >&2
            skip_count=$((skip_count + 1))
            continue
        fi

        # File size?
        if [ -f "$file" ]; then
            local fsize
            fsize=$(_file_size "$file")
            if [ "$fsize" -gt "$MAX_NEW_FILE_SIZE" ]; then
                echo "  SKIP: $file ($((fsize / 1024 / 1024))MB — too large)" >&2
                skip_count=$((skip_count + 1))
                continue
            fi
        fi

        # Secret filename?
        if _is_secret_filename "$file"; then
            echo "  SKIP: $file (filename matches secret pattern)" >&2
            skip_count=$((skip_count + 1))
            continue
        fi

        # Binary?
        if _is_binary "$file"; then
            echo "  SKIP: $file (binary file)" >&2
            skip_count=$((skip_count + 1))
            continue
        fi

        # Secret content? (skip .sh/.py/.rb — they may contain pattern definitions)
        if [[ ! "$file" =~ \.(sh|py|rb|js|ts)$ ]] && _has_secret_content "$file"; then
            echo "  SKIP: $file (content matches secret pattern)" >&2
            skip_count=$((skip_count + 1))
            continue
        fi

        # All checks passed
        git add -- "$file" 2>/dev/null
        staged_count=$((staged_count + 1))

    done <<< "$untracked"

    if [ "$skip_count" -gt 0 ]; then
        echo "Skipped $skip_count file(s) — see above." >&2
    fi

    echo "$staged_count"
}

# Build commit message from staged files
build_commit_msg() {
    local areas
    areas=$(git diff --cached --name-only | while IFS= read -r path; do
        case "$path" in
            brain/ops/daily/*)   echo "daily logs" ;;
            brain/ops/weekly/*)  echo "weekly logs" ;;
            brain/ops/*)         echo "ops" ;;
            brain/wiki/*)        echo "wiki" ;;
            brain/raw/*)         echo "raw sources" ;;
            brain/outputs/*)     echo "outputs" ;;
            brain/logs/*)        echo "legacy logs" ;;
            brain/entities/*)    echo "legacy entities" ;;
            brain/calls/*)       echo "legacy calls" ;;
            brain/library/*)     echo "legacy library" ;;
            brain/context/*)     echo "legacy context" ;;
            brain/*)             echo "brain" ;;
            schemas/*)           echo "schemas" ;;
            .claude/*)           echo "claude config" ;;
            .agents/*)           echo "codex config" ;;
            .codex/*)            echo "codex config" ;;
            .pi/*)               echo "pi config" ;;
            .beads/*)            echo "beads" ;;
            services/*)          echo "services" ;;
            plans/*)             echo "plans" ;;
            scripts/*)           echo "scripts" ;;
            docs/*)              echo "docs" ;;
            *)                   echo "vault" ;;
        esac
    done | sort -u | paste -sd, - | sed 's/,/, /g')
    echo "vault: update ${areas:-files}"
}
