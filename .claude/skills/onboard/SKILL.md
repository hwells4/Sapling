---
name: onboard
description: Onboard new users to SaplingOS. Collects context, configures local hook support, and populates context files.
context_budget:
  skill_md: 200
  max_references: 4
---

<objective>
Guide new users through SaplingOS setup: verify local prerequisites, read available project context, collect identity/business/voice context through sequential questions, configure machine-local hooks, and populate context files.
</objective>

<usage>
```
/onboard              # Start fresh onboarding
/onboard --reset      # Re-run full onboarding (overwrites existing)
```
</usage>

<essential_principles>
1. **One question at a time:** Use AskUserQuestion for each step, never batch questions
2. **Everything skippable:** Every personal context question can be skipped
3. **Graceful degradation:** Scraping failures → offer manual input or skip
4. **Progressive disclosure:** Only load references when needed for specific workflows
</essential_principles>

<dependencies>
**Run these checks before asking personal setup questions.**

```bash
# Beads - task tracking
which bd >/dev/null 2>&1 || echo "MISSING: bd"

# PyYAML (required) - schema validation
python3 -c "import yaml" 2>/dev/null || echo "MISSING: pyyaml"
```

**If Beads missing:**
> Sapling uses Beads for task tracking. Want me to install it now?
> ```
> brew tap steveyegge/beads
> brew install bd
> ```
> If you skip this, onboarding can continue, but `/task` and durable issue tracking will not be ready.

If user approves, run the install command, then continue. If `bd` is available, offer to run `bd onboard` to show the current Beads agent instructions and confirm the repo is ready for Beads-backed work. Do not make users run `bd onboard` manually before Sapling onboarding.

**If PyYAML missing:**
> PyYAML is required for schema validation. Install it with:
> ```
> pip install pyyaml
> ```
> Then run `/onboard` again.

Only block on Python/PyYAML. Beads can be installed, initialized, or explicitly skipped during onboarding.
</dependencies>

<quick_start>
1. **Check dependencies and local docs** — handle Beads setup inside onboarding; block only if Python/PyYAML are missing
2. Read available local context: README.md, AGENTS.md, CLAUDE.md, and existing brain/context files when present
3. Check if context files exist → route appropriately
4. Get their name via AskUserQuestion
5. Welcome with rundown of what's coming (~3-5 min)
6. Business context (skippable): website URL or quick questions
7. Role selection (skippable): founder, engineer, designer, etc.
8. Primary use case (skippable): what they want help with
9. Writing samples (skippable) → analyze → voice-and-style.md
10. Image generation setup (optional) → Gemini API key
11. Local hooks setup → run `.claude/hooks/setup-local-hooks.py`
12. Generate context files from collected data
13. Explain how /today, beads, and /task work
14. Show personalized welcome banner
15. GitHub CLI auth (optional): `gh auth login` for GitHub features
16. Ask about starring the repo (optional): auto-star if authed, else manual link
17. Commit with /commit
18. Suggest `/today` to start first daily log
</quick_start>

<routing>
| Condition | Workflow |
|-----------|----------|
| No context files exist | workflows/fresh-start.md |
| Context files exist, no --reset | Ask: overwrite/merge/cancel |
| --reset flag | workflows/fresh-start.md (force) |
| Resume from interrupted | Load .claude/onboard-state.json, continue |
</routing>

<hook_setup>
**Step 11: Local Hook Setup**

Explain that Sapling registers its core hooks in the project, then uses a local profile to tune behavior for each machine. Offer one profile:

| Profile | Command | Use for |
|---------|---------|---------|
| recommended | `python3 .claude/hooks/setup-local-hooks.py --profile recommended` | Default: daily log, schema/prose checks, skill routing, and git auto-commit/push |
| no-git | `python3 .claude/hooks/setup-local-hooks.py --profile no-git` | Keeps core hooks, but disables git auto-commit/push |

Default to `recommended`. Do not offer schema-less or reduced hook profiles.
</hook_setup>

<context_files>
Files populated during onboarding:

| File | Primary Source | Fallback |
|------|---------------|----------|
| brain/context/about-me.md | Name + Role questions | Defaults |
| brain/context/business.md | Company website | Business type Qs |
| brain/context/voice-and-style.md | Writing samples | Template only |
| brain/context/preferences.md | Use case selection | Defaults |

Templates in: `.claude/skills/onboard/templates/`
</context_files>

<error_handling>
| Error | Recovery |
|-------|----------|
| Website scrape fails | "Couldn't load that—no worries, I'll ask a couple questions instead" |
| Invalid URL | Show example, re-ask |
| Session interrupted | Save to .claude/onboard-state.json, resume on next /onboard |
| All questions skipped | Create minimal files with TODOs |
| API key invalid | Validate format, offer to re-enter or skip |
</error_handling>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/extraction-targets.md | What to extract from company websites |
| workflows/fresh-start.md | Main onboarding workflow |
</references_index>

<success_criteria>
- [ ] User's name collected
- [ ] At least one context file populated (or all skipped with TODOs)
- [ ] Beads checked, installed, initialized, or explicitly skipped
- [ ] System explanation delivered (/today, beads, /task)
- [ ] Welcome banner displayed with name and hook profile
- [ ] Changes committed with /commit
- [ ] User guided to next step (/today)
</success_criteria>
