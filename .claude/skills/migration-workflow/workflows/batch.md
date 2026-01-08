# Batch Migration Workflow

Coordinates large-scale migrations using the state-tracking script and parallel agents.

## When to Use

- 10+ files need migration
- User requests `--batch` or `batch migrate`
- Resuming an interrupted migration

## Architecture

```
Script (coordinator)          Agents (workers)
├── detect                    ├── Read migration-maps.md
├── init state                ├── Read file
├── next batch                ├── Transform frontmatter
├── track progress            ├── Write file
└── report status             └── Report completion
```

Script handles state. Agents do intelligent work.

## Process

### 1. Detection [rigid]

```bash
python3 scripts/migrate-batch.py detect --schema {schema}
```

Report to user:
```
{N} files need migration ({from} → {to})
{M} files already current
```

### 2. Initialize State [rigid]

```bash
python3 scripts/migrate-batch.py init --schema {schema}
```

Creates `scripts/migrations/state.json` tracking all pending files.

### 3. Spawn Migration Agents [flexible]

Calculate batching:
- Files per agent: 5-10 (depending on complexity)
- Max parallel agents: 10
- Total batches: ceil(pending_files / files_per_agent)

For each batch, spawn a Task agent:

```
Migrate these files from {schema} {from_version} to {target_version}.

Rules: Read schemas/migrations/{schema}-{from_version}-to-{to_version}.md

Files:
- brain/calls/file1.md
- brain/calls/file2.md
- brain/calls/file3.md
- brain/calls/file4.md
- brain/calls/file5.md

For each file:
1. Read current frontmatter
2. Apply transformation rules from migration-maps.md
3. Update schema_version to {target_version}
4. Write file using Edit tool
5. Verify validation hook passes

Report which files succeeded and which failed.
```

### 4. Update State After Each Batch [rigid]

When agent reports back:

```bash
# If succeeded
python3 scripts/migrate-batch.py done --files file1.md file2.md ...

# If failed
python3 scripts/migrate-batch.py fail --files file3.md --reason "validation error"
```

### 5. Continue Until Complete [rigid]

Check remaining:
```bash
python3 scripts/migrate-batch.py status
```

If pending > 0, spawn more agents for remaining files.

### 6. Handle Interruption [rigid]

If session ends mid-migration:
```bash
python3 scripts/migrate-batch.py status -v
```

Shows what's pending/in-progress. Spawn agents for remaining files.

## Script Commands

| Command | Purpose |
|---------|---------|
| `detect --schema X` | Find files needing migration |
| `init --schema X` | Initialize state file |
| `status [-v]` | Show progress |
| `next --batch-size N` | Get next N pending files |
| `claim --files ... --agent ID` | Mark files as in-progress |
| `done --files ...` | Mark files as completed |
| `fail --files ... --reason X` | Mark files as failed |
| `reset` | Clear state file |

## Example Session

```
User: batch migrate call

Agent: Detecting files...

Schema: call (target: 1.1.0)
Current: 0 files
Needs migration: 47 files

Initializing migration state...
Migration ID: 2025-12-28-call-1.1.0

Spawning migration agents (10 batches of 5 files each)...

[Agent 1] Processing files 1-5...
[Agent 2] Processing files 6-10...
...

Results from Agent 1: 5/5 succeeded
Results from Agent 2: 4/5 succeeded, 1 failed (validation error)
...

Migration complete:
- 45 files migrated successfully
- 2 files failed (see status for details)

To retry failed: python3 scripts/migrate-batch.py status -v
```

## Parallel Agent Spawning

Use multiple Task tool calls in one message:

```python
# Spawn up to 10 agents in parallel
for batch in batches[:10]:
    Task(
        subagent_type="general-purpose",
        prompt=f"Migrate these files: {batch}...",
        description=f"Migrate batch {batch_num}"
    )
```

## Integration

- Uses `schemas/migrations/{schema}-{from}-to-{to}.md` for transformation rules
- Schema update hook auto-generates migration files when schemas change
- Validation hook catches errors automatically
- State persists in `scripts/migrations/state.json`
- Git provides rollback if needed
