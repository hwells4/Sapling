# Creature Reference

## Overview

Users select an elemental egg during onboarding.

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

## Art Files

Each creature keeps art in its own directory. Onboarding displays the egg art.

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
2. Read art file: `.claude/creatures/{creature}/egg.txt`
3. Display with creature name

## Banner Template

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   {EMOJI} {CREATURE_NAME}                                      ║
║                                                               ║
║   {ART_CONTENT}                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Emoji Map

| Creature | Emoji |
|----------|-------|
| ember | 🔥 |
| drift | 💧 |
| bloom | 🌿 |
