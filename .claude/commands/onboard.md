# Onboard Command

Interactive onboarding for new Sapling OS users. Collects context through an interview, lets you choose a companion creature, and optionally sets up image generation.

## Usage

```
/onboard              # Start fresh onboarding
/onboard --creature   # Just change creature selection
/onboard --reset      # Re-run full onboarding (overwrites existing)
```

## What Happens

### Phase 1: Welcome & Creature Selection
- Choose your elemental companion (Fire/Water/Nature)
- Creature starts as an egg, evolves as you use the system

### Phase 2: Context Collection (All Skippable)
- LinkedIn profile URL (scraped for background)
- Company website (scraped for business context)
- Writing samples (analyzed for voice/style)
- Follow-up questions to fill gaps

### Phase 3: Image Generation Setup (Optional)
- Set up nano-banana for generating PDFs, slide decks, carousel graphics
- Walks you through getting a Gemini API key from Google

### Phase 4: File Generation
Creates context files in `brain/context/`:
- `about-me.md` - Your identity and background
- `business.md` - Company and client info
- `voice-and-style.md` - Writing preferences
- `preferences.md` - Tool preferences

### Phase 5: Explain the System
- How context files work
- How `/task` traces your decisions
- How `/calibrate` tailors the system to you
- How your creature evolves

### Phase 6: Commit & Finish
- Uses `/commit` to save all generated files
- Shows your creature and next steps

## Creatures

| Element | Egg | Creature | Theme |
|---------|-----|----------|-------|
| Fire | Red/Orange | **Ember** | Burns through blockers, iterates fast |
| Water | Blue | **Drift** | Flows around obstacles, adaptable |
| Nature | Green | **Bloom** | Grows organically, cultivates knowledge |

Creatures evolve based on decision traces processed:
- **Egg**: 0-9 traces
- **Hatchling**: 10-99 traces (hatches after first `/calibrate`)
- **Juvenile**: 100-499 traces
- **Adult**: 500-1499 traces
- **Legendary**: 1500+ traces

## Files Modified

- `.claude/stats.yaml` - Creature selection and onboard timestamp
- `brain/context/*.md` - Context files
- `.env.local` - API keys (if image generation enabled)

## Resume Support

If onboarding is interrupted, progress is saved to `.claude/onboard-state.json`. Running `/onboard` again resumes from where you left off.

## Related Commands

- `/today` - Create your first daily note (suggested after onboard)
- `/calibrate` - Process decision traces (hatches your creature)
- `/task` - Start a task with decision tracing

---
*Command Version: 2.0*
