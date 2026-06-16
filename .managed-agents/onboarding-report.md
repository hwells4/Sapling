# Managed Agents onboarding report for hwells4/Sapling

## What is ready

Sapling now has the baseline files Managed Agents expects: setup, start, and stop hooks; Pi runtime settings; Pi-readable repository instructions; and one simple Sapling vault skill. The repository can boot as a knowledge-system workspace without needing an app server.

## What I changed

- Added `.managed-agents/setup.sh` to install the small Python dependency used by the vault hooks and install Pi npm packages when present.
- Added `.managed-agents/start.sh` as a fast launch-only hook. It returns immediately because Sapling does not run a web server.
- Added `.managed-agents/stop.sh` as a safe no-op so prompt completion stays fast and non-destructive.
- Replaced the local Pi settings with a safe baseline that keeps Pi package support and avoids committing private tokens.
- Added `.pi/APPEND_SYSTEM.md` with the important Sapling rules in Pi-readable form.
- Added `.pi/skills/sapling-vault/SKILL.md` for safe vault file and durable-output workflows.
- Added this report and the machine-readable onboarding status file.

## What I checked

I inspected the existing Claude setup, including commands, skills, hooks, hook router code, local agent instructions, vault schemas, Pi settings, and environment examples. I also checked that the new scripts are executable and can run without exposing secrets.

## Optional improvements

- Migrate selected Claude slash commands into Pi skills or prompt templates so Managed Agents can use the same workflows for `/today`, `/task`, `/create-skill`, `/ideate`, `/refine`, and GitHub repository work.
- Recreate the useful parts of the Claude hook router in Pi only after you approve which automation you want. This could preserve vault validation and context reminders while avoiding surprise auto-commits.
- Move Linear MCP configuration to a secret-backed Managed Agents setting so the repository can connect to Linear without storing a token in the repo.
- Port the image-generation workflow once a Gemini API key is available through Managed Agents secrets.

## What still needs a person

A person should decide whether the current Claude automation should be reproduced in Managed Agents. Some existing behavior commits, syncs, or pushes automatically, so it should not be ported without explicit approval.
