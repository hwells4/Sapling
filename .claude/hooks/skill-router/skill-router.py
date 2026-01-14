#!/usr/bin/env python3
"""
Skill Evaluation Engine v2.0 (Python)

Intelligent skill activation based on:
- Keywords and patterns in prompts
- File paths mentioned or being edited
- Directory mappings
- Intent detection
- Content pattern matching

Outputs a structured reminder with matched skills and reasons.
Reads from stdin (JSON with prompt field) and outputs to stdout.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional


def load_rules(rules_path: Path) -> dict:
    """Load skill rules from JSON file."""
    try:
        with open(rules_path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        return {}


def extract_file_paths(prompt: str) -> list[str]:
    """Extract file paths mentioned in the prompt."""
    paths = set()

    # Match explicit paths with extensions
    extension_pattern = r'(?:^|\s|["\'\`])([\w\-./]+\.(?:[tj]sx?|json|gql|ya?ml|md|sh|py|rb|go|rs))\b'
    for match in re.finditer(extension_pattern, prompt, re.IGNORECASE):
        paths.add(match.group(1))

    # Match paths starting with common directories
    dir_pattern = r'(?:^|\s|["\'\`])((?:src|app|lib|components|screens|hooks|utils|services|\.claude|\.github|brain|schemas)\/[\w\-./]+)'
    for match in re.finditer(dir_pattern, prompt, re.IGNORECASE):
        paths.add(match.group(1))

    # Match quoted paths
    quoted_pattern = r'["\'\`]([\w\-./]+\/[\w\-./]+)["\'\`]'
    for match in re.finditer(quoted_pattern, prompt):
        paths.add(match.group(1))

    return list(paths)


def matches_pattern(text: str, pattern: str, flags: int = re.IGNORECASE) -> bool:
    """Check if a pattern matches the text."""
    try:
        return bool(re.search(pattern, text, flags))
    except re.error:
        return False


def matches_glob(file_path: str, glob_pattern: str) -> bool:
    """Check if a glob pattern matches a file path (simplified)."""
    # Convert glob to regex
    regex_pattern = glob_pattern
    regex_pattern = regex_pattern.replace(".", r"\.")
    regex_pattern = regex_pattern.replace("**/", "<<<DOUBLESTARSLASH>>>")
    regex_pattern = regex_pattern.replace("**", "<<<DOUBLESTAR>>>")
    regex_pattern = regex_pattern.replace("*", "[^/]*")
    regex_pattern = regex_pattern.replace("<<<DOUBLESTARSLASH>>>", "(.*\\/)?")
    regex_pattern = regex_pattern.replace("<<<DOUBLESTAR>>>", ".*")
    regex_pattern = regex_pattern.replace("?", ".")

    try:
        return bool(re.match(f"^{regex_pattern}$", file_path, re.IGNORECASE))
    except re.error:
        return False


def match_directory_mapping(file_path: str, mappings: dict) -> Optional[str]:
    """Check if file path matches any directory mapping."""
    for directory, skill_name in mappings.items():
        if file_path == directory or file_path.startswith(f"{directory}/"):
            return skill_name
    return None


def evaluate_skill(
    skill_name: str,
    skill: dict,
    prompt: str,
    prompt_lower: str,
    file_paths: list[str],
    rules: dict,
) -> Optional[dict]:
    """Evaluate a single skill against the prompt and context."""
    triggers = skill.get("triggers", {})
    exclude_patterns = skill.get("excludePatterns", [])
    priority = skill.get("priority", 5)
    scoring = rules.get("scoring", {})

    score = 0
    reasons = []

    # Check exclude patterns first
    for exclude_pattern in exclude_patterns:
        if matches_pattern(prompt_lower, exclude_pattern):
            return None

    # 1. Check keywords
    keywords = triggers.get("keywords", [])
    for keyword in keywords:
        if keyword.lower() in prompt_lower:
            score += scoring.get("keyword", 2)
            reasons.append(f'keyword "{keyword}"')

    # 2. Check keyword patterns (regex)
    keyword_patterns = triggers.get("keywordPatterns", [])
    for pattern in keyword_patterns:
        if matches_pattern(prompt_lower, pattern):
            score += scoring.get("keywordPattern", 3)
            reasons.append(f"pattern /{pattern}/")

    # 3. Check intent patterns
    intent_patterns = triggers.get("intentPatterns", [])
    for pattern in intent_patterns:
        if matches_pattern(prompt_lower, pattern):
            score += scoring.get("intentPattern", 4)
            reasons.append("intent detected")
            break  # Only count once

    # 4. Check context patterns
    context_patterns = triggers.get("contextPatterns", [])
    for pattern in context_patterns:
        if pattern.lower() in prompt_lower:
            score += scoring.get("contextPattern", 2)
            reasons.append(f'context "{pattern}"')

    # 5. Check file paths against path patterns
    path_patterns = triggers.get("pathPatterns", [])
    if path_patterns and file_paths:
        for file_path in file_paths:
            for pattern in path_patterns:
                if matches_glob(file_path, pattern):
                    score += scoring.get("pathPattern", 4)
                    reasons.append(f'path "{file_path}"')
                    break

    # 6. Check directory mappings
    directory_mappings = rules.get("directoryMappings", {})
    if directory_mappings and file_paths:
        for file_path in file_paths:
            mapped_skill = match_directory_mapping(file_path, directory_mappings)
            if mapped_skill == skill_name:
                score += scoring.get("directoryMatch", 5)
                reasons.append("directory mapping")
                break

    # 7. Check content patterns in prompt
    content_patterns = triggers.get("contentPatterns", [])
    for pattern in content_patterns:
        if matches_pattern(prompt, pattern):
            score += scoring.get("contentPattern", 3)
            reasons.append("code pattern detected")
            break

    if score > 0:
        return {
            "name": skill_name,
            "score": score,
            "reasons": list(set(reasons)),
            "priority": priority,
        }

    return None


def get_related_skills(matches: list[dict], skills: dict) -> list[str]:
    """Get related skills that should also be suggested."""
    matched_names = {m["name"] for m in matches}
    related = set()

    for match in matches:
        skill = skills.get(match["name"], {})
        for related_name in skill.get("relatedSkills", []):
            if related_name not in matched_names:
                related.add(related_name)

    return list(related)


def format_confidence(score: int, min_score: int) -> str:
    """Format confidence level based on score."""
    if score >= min_score * 3:
        return "HIGH"
    if score >= min_score * 2:
        return "MEDIUM"
    return "LOW"


def evaluate(prompt: str, rules: dict) -> str:
    """Main evaluation function."""
    config = rules.get("config", {})
    skills = rules.get("skills", {})

    if not skills:
        return ""

    prompt_lower = prompt.lower()
    file_paths = extract_file_paths(prompt)

    # Evaluate all skills
    matches = []
    min_confidence = config.get("minConfidenceScore", 3)

    for name, skill in skills.items():
        match = evaluate_skill(name, skill, prompt, prompt_lower, file_paths, rules)
        if match and match["score"] >= min_confidence:
            matches.append(match)

    if not matches:
        return ""

    # Sort by score (descending), then by priority (descending)
    matches.sort(key=lambda m: (-m["score"], -m["priority"]))

    # Limit to max skills
    max_skills = config.get("maxSkillsToShow", 5)
    top_matches = matches[:max_skills]

    # Check for related skills
    related_skills = get_related_skills(top_matches, skills)

    # Format output
    lines = ["<user-prompt-submit-hook>", "SKILL ACTIVATION SUGGESTED", ""]

    if file_paths:
        lines.append(f"Detected file paths: {', '.join(file_paths)}")
        lines.append("")

    lines.append("Matched skills (ranked by relevance):")

    show_reasons = config.get("showMatchReasons", True)

    for i, match in enumerate(top_matches, 1):
        confidence = format_confidence(match["score"], min_confidence)
        lines.append(f"{i}. {match['name']} ({confidence} confidence)")

        if show_reasons and match["reasons"]:
            reasons_str = ", ".join(match["reasons"][:3])
            lines.append(f"   Matched: {reasons_str}")

    if related_skills:
        lines.append("")
        lines.append(f"Related skills to consider: {', '.join(related_skills)}")

    lines.extend([
        "",
        "Before implementing, you MUST:",
        "1. EVALUATE: State YES/NO for each skill with brief reasoning",
        "2. ACTIVATE: Invoke the Skill tool for each YES skill",
        "3. IMPLEMENT: Only proceed after skill activation",
        "",
        "Example evaluation:",
        f"- {top_matches[0]['name']}: YES - [your reasoning]",
    ])

    if len(top_matches) > 1:
        lines.append(f"- {top_matches[1]['name']}: NO - [your reasoning]")

    lines.extend([
        "",
        "DO NOT skip this step. Invoke relevant skills NOW.",
        "</user-prompt-submit-hook>",
    ])

    return "\n".join(lines)


def main():
    """Main entry point."""
    # Read prompt from stdin
    try:
        input_data = sys.stdin.read()
    except Exception:
        sys.exit(0)

    # Parse input (JSON with prompt field, or raw text)
    prompt = ""
    try:
        data = json.loads(input_data)
        prompt = data.get("prompt", "")
    except json.JSONDecodeError:
        prompt = input_data

    if not prompt.strip():
        sys.exit(0)

    # Load rules
    script_dir = Path(__file__).parent
    rules_path = script_dir / "skill-rules.json"

    # Generate rules if they don't exist or are outdated
    if not rules_path.exists():
        # Try to generate rules
        generate_script = script_dir / "generate-rules.py"
        if generate_script.exists():
            import subprocess
            try:
                subprocess.run(
                    ["python3", str(generate_script)],
                    capture_output=True,
                    timeout=5,
                    env={**os.environ, "CLAUDE_PROJECT_DIR": os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())},
                )
            except Exception:
                pass

    rules = load_rules(rules_path)

    if not rules:
        sys.exit(0)

    # Evaluate and output
    try:
        output = evaluate(prompt, rules)
        if output:
            print(output)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
