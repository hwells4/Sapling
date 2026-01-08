# Context Files

This directory holds information about you that helps Claude personalize responses.

## Files

| File | Purpose |
|------|---------|
| `about-me.md` | Your identity, role, background, goals |
| `business.md` | Your company, services, ideal clients |
| `voice-and-style.md` | Writing preferences, tone, vocabulary |
| `preferences.md` | Working style, tools, automation preferences |

## Setup

Run `/onboard` in Claude Code to populate these files through an interactive interview.

Or create them manually using the templates in `.claude/skills/onboard/templates/`.

## How Claude Uses These

When executing tasks, Claude reads relevant context files to:
- Match your writing voice
- Understand your business domain
- Reference your goals and priorities
- Avoid asking questions it already knows answers to

## Updating

Edit these files anytime. Claude will pick up changes on the next task.
