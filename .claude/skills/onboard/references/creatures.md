# Creature Reference

## Overview

Users select an elemental egg during onboarding. The creature hatches after first calibration (10 traces processed).

## Creatures

### Ember (Fire)
- **Element:** 🔥 Fire
- **Theme:** Burns through blockers, iterates fast
- **Personality:** Impatient with obstacles, loves rapid progress
- **Art directory:** `.claude/creatures/ember/`

### Drift (Water)
- **Element:** 💧 Water
- **Theme:** Flows around obstacles, adaptable
- **Personality:** Patient, finds alternative paths, flexible
- **Art directory:** `.claude/creatures/drift/`

### Bloom (Nature)
- **Element:** 🌿 Nature
- **Theme:** Grows organically, cultivates knowledge
- **Personality:** Nurturing, builds foundations, long-term thinker
- **Art directory:** `.claude/creatures/bloom/`

## Evolution Stages

| Stage | Traces | Art Height | Description |
|-------|--------|------------|-------------|
| Egg | 0-9 | 3 lines | Dormant, waiting to hatch |
| Hatchling | 10-99 | 5 lines | Just born, learning the basics |
| Juvenile | 100-499 | 7 lines | Growing, developing abilities |
| Adult | 500-1499 | 9 lines | Fully capable, reliable companion |
| Legendary | 1500+ | 11 lines | Mastered, rare achievement |

The creature literally grows taller as it evolves!

## Art Files

Each creature has art for each stage:

```
.claude/creatures/
├── ember/
│   ├── egg.txt
│   ├── hatchling.txt
│   ├── juvenile.txt
│   ├── adult.txt
│   └── legendary.txt
├── drift/
│   └── (same structure)
└── bloom/
    └── (same structure)
```

## Display Logic

To display current creature state:

1. Read `.claude/stats.yaml` for:
   - `creature`: ember|drift|bloom
   - `total_traces_processed`: number
2. Calculate stage from traces:
   - 0-9 → egg
   - 10-99 → hatchling
   - 100-499 → juvenile
   - 500-1499 → adult
   - 1500+ → legendary
3. Read art file: `.claude/creatures/{creature}/{stage}.txt`
4. Display with creature name and progress bar

## Banner Template

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   {EMOJI} {CREATURE_NAME} - {STAGE}                           ║
║                                                               ║
║   {ART_CONTENT}                                               ║
║                                                               ║
║   [{PROGRESS_BAR}] {CURRENT}/{NEXT_THRESHOLD} to {NEXT_STAGE} ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Emoji Map

| Creature | Emoji |
|----------|-------|
| ember | 🔥 |
| drift | 💧 |
| bloom | 🌿 |
