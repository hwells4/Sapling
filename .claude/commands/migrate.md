---
description: Migrate vault files to current schema versions
argument-hint: <schema>
---

# /migrate Command

Migrate vault files from legacy formats to current schema versions.

## Usage

```
/migrate library       # Migrate library files
/migrate trace         # Migrate trace files
/migrate               # Detect all schemas needing migration
```

## Execution

**IMMEDIATELY invoke the `migration-workflow` skill** using the Skill tool:

```
Skill(skill: "migration-workflow", args: "$ARGUMENTS")
```

The skill handles everything:
1. Detect schemas needing migration (or use specified schema)
2. Show migration summary
3. Offer options: preview, migrate all, or interactive mode
4. Apply migrations with validation
