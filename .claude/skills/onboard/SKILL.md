---
name: onboard
description: Onboard new users to Personal OS. Collects context through interview, lets user choose a creature companion, and populates context files.
context_budget:
  skill_md: 200
  max_references: 4
---

<objective>
Guide new users through Personal OS setup: collect identity/business/voice context through sequential questions, let them choose an elemental creature companion, and populate context files.
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

<quick_start>
1. Check if context files exist → route appropriately
2. Show welcome with time estimate (~5 min)
3. Creature selection (required): Fire egg, Water egg, or Nature egg
4. LinkedIn URL (skippable) → scrape → about-me.md
5. Company website (skippable) → scrape → business.md
6. Writing samples (skippable) → analyze → voice-and-style.md
7. 5 follow-up questions (each skippable) → fill gaps
8. Generate context files from collected data
9. Show creature + welcome banner
10. Suggest `/today` to start first daily note
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

<context_files>
Files populated during onboarding:

| File | Primary Source | Fallback |
|------|---------------|----------|
| brain/context/about-me.md | LinkedIn | Follow-up Qs |
| brain/context/business.md | Company website | Follow-up Qs |
| brain/context/voice-and-style.md | Writing samples | Template only |
| brain/context/preferences.md | Follow-up Qs | Defaults |

Templates in: `.claude/skills/onboard/templates/`
</context_files>

<error_handling>
| Error | Recovery |
|-------|----------|
| URL scrape fails | Offer: Retry / Skip / Enter manually |
| Invalid URL | Show example, re-ask |
| Session interrupted | Save to .claude/onboard-state.json |
| All questions skipped | Create minimal files with TODOs |
</error_handling>

<references_index>
| Reference | Purpose |
|-----------|---------|
| references/extraction-targets.md | What to extract from URLs |
| references/follow-up-questions.md | Dynamic question bank |
| references/creatures.md | Creature definitions + art paths |
</references_index>

<success_criteria>
- [ ] Creature selected and stored in .claude/stats.yaml
- [ ] At least one context file populated (or all skipped with TODOs)
- [ ] Welcome banner displayed with creature
- [ ] User guided to next step (/today)
</success_criteria>
