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
/onboard --creature   # Just change creature selection
/onboard --reset      # Re-run full onboarding (overwrites existing)
```
</usage>

<essential_principles>
1. **One question at a time:** Use AskUserQuestion for each step, never batch questions
2. **Everything skippable:** Every question can be skipped (except creature selection)
3. **Graceful degradation:** Scraping failures → offer manual input or skip
4. **Immediate payoff:** First calibration after onboarding hatches the egg
5. **Progressive disclosure:** Only load references when needed for specific workflows
</essential_principles>

<dependencies>
**Run these checks before anything else. Block onboarding if critical deps missing.**

```bash
# Beads (required) - task tracking
which bd >/dev/null 2>&1 || echo "MISSING: bd"

# PyYAML (required) - schema validation
python3 -c "import yaml" 2>/dev/null || echo "MISSING: pyyaml"
```

**If Beads missing:**
> Beads is required for task tracking. Install it with:
> ```
> brew tap steveyegge/beads
> brew install bd
> ```
> Then run `/onboard` again.

**If PyYAML missing:**
> PyYAML is required for schema validation. Install it with:
> ```
> pip install pyyaml
> ```
> Then run `/onboard` again.

Only proceed if both checks pass.
</dependencies>

<quick_start>
1. **Check dependencies and local docs** — block if missing (see `<dependencies>`)
2. Read available local context: README.md, AGENTS.md, CLAUDE.md, and existing brain/context files when present
3. Check if context files exist → route appropriately
4. Get their name via AskUserQuestion
5. Welcome with rundown of what's coming (~3-5 min)
6. Creature selection (required): Fire egg, Water egg, or Nature egg
7. Business context (skippable): website URL or quick questions
8. Role selection (skippable): founder, engineer, designer, etc.
9. Primary use case (skippable): what they want help with
10. Writing samples (skippable) → analyze → voice-and-style.md
11. Image generation setup (optional) → Gemini API key
12. Local hooks setup → run `.claude/hooks/setup-local-hooks.py`
13. Generate context files from collected data
14. Explain how /today, beads, and /task work
15. Show personalized welcome banner
16. GitHub CLI auth (optional): `gh auth login` for GitHub features
17. Ask about starring the repo (optional): auto-star if authed, else manual link
18. Commit with /commit
19. Suggest `/today` to start first daily note
</quick_start>

<routing>
| Condition | Workflow |
|-----------|----------|
| No context files exist | workflows/fresh-start.md |
| Context files exist, no --reset | Ask: overwrite/merge/cancel |
| --creature flag | workflows/creature-select.md |
| --reset flag | workflows/fresh-start.md (force) |
| Resume from interrupted | Load .claude/onboard-state.json, continue |
</routing>

<creatures>
User selects an elemental egg. The creature inside hatches after first calibration (10 traces).

| Element | Egg | Creature | Theme |
|---------|-----|----------|-------|
| 🔥 Fire | Red/Orange | **Ember** | Burns through blockers, iterates fast |
| 💧 Water | Blue | **Drift** | Flows around obstacles, adaptable |
| 🌿 Nature | Green | **Bloom** | Grows organically, cultivates knowledge |

**Evolution stages:**
| Level | Traces | Stage |
|-------|--------|-------|
| 1 | 0-9 | Egg |
| 2 | 10-99 | Hatchling |
| 3 | 100-499 | Juvenile |
| 4 | 500-1499 | Adult |
| 5 | 1500+ | Legendary |

Creature art stored in `.claude/creatures/{name}/{stage}.txt`
</creatures>

<hook_setup>
**Step 11: Local Hook Setup**

Explain that Sapling registers its core hooks in the project, then uses a local profile to tune behavior for each machine. Offer one profile:

| Profile | Command | Use for |
|---------|---------|---------|
| recommended | `python3 .claude/hooks/setup-local-hooks.py --profile recommended` | Default: daily note, schema/prose checks, skill routing, and git auto-commit/push |
| no-git | `python3 .claude/hooks/setup-local-hooks.py --profile no-git` | Keeps core hooks, but disables git auto-commit/push |

Default to `recommended`. Do not offer a schema-less or daily-note-only profile.
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
| references/creatures.md | Creature definitions + art paths |
| workflows/fresh-start.md | Main onboarding workflow |
</references_index>

<success_criteria>
- [ ] User's name collected
- [ ] Creature selected and stored in .claude/stats.yaml
- [ ] At least one context file populated (or all skipped with TODOs)
- [ ] System explanation delivered (/today, beads, /task)
- [ ] Welcome banner displayed with creature and name
- [ ] Changes committed with /commit
- [ ] User guided to next step (/today)
</success_criteria>
