# Onboard Command

Interactive onboarding for new Sapling OS users. Collects context through an interview, configures local hook support, and optionally sets up integrations.

## Usage

```
/onboard              # Start fresh onboarding
/onboard --creature   # Just change creature selection
/onboard --reset      # Re-run full onboarding (overwrites existing)
```

## What Happens

### Phase 1: Welcome & Introduction
- Get your name and give you a quick rundown
- Choose your elemental companion (Fire/Water/Nature)
- Creature starts as an egg, evolves as you use the system

### Phase 2: Understanding Your Work (All Skippable)
- Business context (website or quick questions)
- Your role (founder, engineer, designer, etc.)
- Primary use case for Sapling OS
- Writing samples (analyzed for voice/style)

### Phase 3: Image Generation Setup (Optional)
- Set up nano-banana for generating PDFs, slide decks, carousel graphics
- Walks you through getting a Gemini API key from Google

### Phase 3.5: Call Recording Setup (Optional)
- If Granola is detected, asks if you want to auto-sync meeting notes
- Installs a background daemon that watches for new calls
- Meeting summaries sync to `brain/calls/` automatically

### Phase 3.6: Local Hook Setup (Recommended)
- Explain that hooks are core Sapling behavior and can be tuned per machine
- Offer `minimal`, `recommended`, and `full` profiles
- Run `.claude/hooks/setup-local-hooks.py --profile {choice}`
- Use `recommended` unless the user wants no hooks or explicitly wants git auto-commit/push

### Phase 4: File Generation
Creates context files in `brain/context/`:
- `about-me.md` - Your identity and background
- `business.md` - Company and client info
- `voice-and-style.md` - Writing preferences
- `preferences.md` - Tool preferences

### Phase 5: Explain the System
- How context files work
- How `/today` opens the daily note
- How beads tracks real work
- How `/task` can be used for larger tracked workflows

### Phase 6: Commit & Finish
- Uses `/commit` to save all generated files
- Shows your creature and next steps

## Creatures

| Element | Egg | Creature | Theme |
|---------|-----|----------|-------|
| Fire | Red/Orange | **Ember** | Burns through blockers, iterates fast |
| Water | Blue | **Drift** | Flows around obstacles, adaptable |
| Nature | Green | **Bloom** | Grows organically, cultivates knowledge |

Creatures are selected during onboarding and stored in `.claude/stats.yaml`.

## Files Modified

- `.claude/stats.yaml` - Creature selection and onboard timestamp
- `brain/context/*.md` - Context files
- `.env.local` - API keys (if image generation enabled)

## Resume Support

If onboarding is interrupted, progress is saved to `.claude/onboard-state.json`. Running `/onboard` again resumes from where you left off.

## Related Commands

- `/today` - Create your first daily note (suggested after onboard)
- `/task` - Start tracked work

---
*Command Version: 2.0*
