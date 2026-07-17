---
schema_version: 1.1.0
date: 2026-06-16
type: plan
status: draft
tags:
  - date/2026-06-16
  - output
  - output/plan
  - status/draft
---

# Managed Agents migration plan for hwells4/Sapling

## What is already ready

The baseline onboarding is ready for review. Sapling now has Managed Agents setup, start, and stop hooks; safe Pi settings; Pi-readable repository instructions; and a simple Sapling vault skill for working with `brain/` files and durable outputs.

## Suggested migration items

### 1. Port the day-to-day Claude commands

Useful commands found: `/today`, `/task`, `/create-skill`, `/ideate`, `/refine`, `/commit`, `/push`, `/onboard`, and `/add-skill`.

Why this helps: these commands are the normal entry points for Sapling work. Porting the safe ones would make Managed Agents feel familiar and reduce the need to remember repository details.

What would change: selected command workflows would become Pi skills or prompt templates. Commands that commit or push would be made explicit and reviewable instead of silently automatic.

Needs from a person: decide which commands should exist in Pi and whether Git commands should remain manual, assisted, or automated.

### 2. Port safe vault validation and context reminders

Useful hooks found: schema validation for new vault files, stats-file protection, prose checks, skill routing, memory/context reminders, daily log setup, session logging, and continuation notes.

Why this helps: these automations keep the vault organized and stop common mistakes, such as writing malformed frontmatter or editing generated stats directly.

What would change: the safe checks would be rebuilt as Pi-friendly guidance, skills, or explicit validation commands. The baseline does not automatically recreate the hook router because hook behavior differs between Claude and Pi.

Needs from a person: choose which reminders and validations are worth keeping in Managed Agents.

### 3. Review Git automation before porting

Git automation found: startup sync, smart staging, stop-time auto-commit, and push-oriented commands.

Why this helps: the existing Claude setup is designed to keep work saved, but automatic Git actions can surprise users if copied into another runtime unchanged.

What would change: a later migration could add explicit Pi workflows for staging, committing, pulling, syncing Beads, and pushing. The safest version would ask before merges or other high-impact actions.

Needs from a person: approve the exact level of Git automation you want.

### 4. Move external integrations to Managed Agents secrets

Integrations found: a Linear MCP configuration in Pi settings, GitHub CLI workflows, and Gemini image generation.

Why this helps: Managed Agents can use integrations without storing private tokens in the repository.

What would change: repository settings would reference secret names or documented setup steps instead of hardcoded credentials. The previous local token value should not be committed.

Secrets or permissions needed: `GEMINI_API_KEY` for visuals, `GITHUB_TOKEN` or `gh auth` for GitHub workflows, and a Linear access token for Linear MCP.

### 5. Port selected Claude skills

Skills found: create-skill, generate-prd, generate-stories, generate-visuals, github, obsidian-vault-ops, onboard, and plan-refinery.

Why this helps: these are the reusable Sapling workflows. The simple vault workflow is already represented by the new Pi skill; the larger skills should be migrated deliberately.

What would change: instruction-only skills could become Pi skills. Skills that require special tools, user-question tools, image generation, GitHub access, or subagents would become follow-up tasks with verification.

Needs from a person: approve which skills matter most and provide any needed credentials.

## Recommended subagent-sized follow-up tasks

1. **Command migration review:** convert safe slash-command workflows into Pi skills or prompt templates and leave Git-changing commands explicit.
2. **Vault guardrails migration:** port schema validation, stats protection, and durable-output reminders into Pi-friendly checks.
3. **Git workflow design:** propose and implement a non-surprising commit/push workflow for Managed Agents.
4. **Integration setup:** move Linear, GitHub, and Gemini setup to secret-backed Managed Agents documentation/configuration.
5. **Skill migration:** port the highest-value Claude skills one at a time, starting with PRD/story generation or GitHub workflows depending on user preference.
