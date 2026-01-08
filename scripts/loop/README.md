# Loop

Autonomous execution of multi-step plans with context management.

## When to use

- Extending Personal OS with new features
- Long-running batch processing (e.g., process 1000 documents)
- Any multi-step work that benefits from fresh context per task
- Plans too large to hold in a single conversation

## How it works

```
/generate-prd  →  prd.json      →  loop.sh  →  Autonomous execution
/generate-stories  →  progress.txt accumulates learnings
```

1. **Plan**: Use `/generate-prd` to define what you're building, then `/generate-stories` to break it into tasks
2. **Configure**: Create `prompt.md` with instructions for how the agent should work
3. **Run**: Execute `loop.sh` - each iteration picks a task, implements it, commits, repeats
4. **Learn**: `progress.txt` accumulates patterns and learnings across iterations

## Files

| File | Purpose |
|------|---------|
| `prd.json` | Tasks with acceptance criteria (from /generate-stories) |
| `progress.txt` | Accumulated learnings across iterations |
| `prompt.md` | Instructions for each iteration (you create this) |

## Usage

```bash
# Test single iteration first
./loop-once.sh

# Run autonomously (default 25 iterations)
./loop.sh

# Run with custom limit
./loop.sh 50

# Archive completed work and start fresh
./loop-archive.sh "feature-name"
```

## The loop

Each iteration:
1. Agent reads `prompt.md` + `prd.json` + `progress.txt`
2. Picks next incomplete task
3. Implements and verifies
4. Commits changes
5. Updates `progress.txt` with learnings
6. Signals `<promise>COMPLETE</promise>` when all done

Fresh context each iteration prevents degradation on long runs.
