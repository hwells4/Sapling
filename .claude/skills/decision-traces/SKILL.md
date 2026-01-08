---
name: decision-traces
description: Extract meaningful decisions from completed tasks. Decisions must be actionable for future agents - not logs, research, or speculation.
schema: schemas/vault/trace.yaml
---

<objective>
Capture decisions that change future behavior. If a future agent wouldn't act differently after reading this trace, don't write it.
</objective>

<permission_to_skip>
You may return zero decisions if:
- Task was straightforward with no alternatives considered
- All choices were obvious with no trade-offs
- Nothing would help a future agent make a better choice

Quality over quantity. An empty trace is honest; forced extraction creates noise.
</permission_to_skip>

<litmus_test>
Ask THREE questions. All must be "yes" to trace:

1. **Is this a choice between alternatives?** (A over B, not just "we did A")
2. **Does it change future behavior?** (Would an agent act differently knowing this?)
3. **Is the reasoning non-obvious?** (Not already in conventions/docs/skills)

**Hard rule:** No trace file is better than a trace full of noise.
</litmus_test>

<anti_patterns>
**These are NOT decisions - do not trace them:**

1. **Execution logs** - "Used parallel agents", "Committed atomically", "Spawned 5 subagents"
   - Test: Would we ever do it differently? If parallelization is always better, it's not a decision.

2. **Research findings** - "API has rate limits", "Library X supports Y"
   - Test: Is there a choice being made? Findings belong in knowledge notes, not traces.

3. **Following conventions** - "Used kebab-case", "Added frontmatter"
   - Test: Was there an alternative considered? Following docs isn't a decision.

4. **Unverified predictions** - "Expected: faster completion", "Should improve clarity"
   - Test: Has this been proven? Speculation isn't insight. Remove "Expected:" fields.

5. **Placeholder decisions** - "Include X in document", "Add section for Y"
   - Test: Does this help beyond this task? Document structure choices rarely generalize.
</anti_patterns>

<examples>
### Good Traces

```markdown
### Subagents for context isolation, not just complexity
**Reasoning:** Assumed subagents are for hard tasks. Wrong - they're for keeping orchestrator context clean. Editing 15 files directly polluted context with content irrelevant after each edit.
**Trigger:** Use subagents when reading/editing 3+ files, regardless of difficulty.
```
*Passes litmus: Choice (direct vs subagent), changes behavior (new trigger rule), non-obvious (complexity intuition was wrong).*

```markdown
### Progressive disclosure over monolithic context loading
**Reasoning:** Anthropic benchmarks show 0.8% efficiency with full dumps vs ~100% with layered loading. Structure beats content reduction.
```
*Passes litmus: Choice (load all vs layer), changes behavior (structure skills differently), non-obvious (quantified evidence).*

```markdown
### Linear owns projects, Obsidian owns relationships
**Reasoning:** Duplicating PRD content creates stale data. Each system owns what it's good at.
```
*Passes litmus: Choice (duplicate vs separate), changes behavior (don't sync), non-obvious (tempting to have everything everywhere).*

### Bad Traces (Do NOT write these)

```markdown
### Parallel agents over sequential processing
**Reasoning:** Faster completion, isolated context.
```
*Fails: No alternative considered (parallel is always better for independent work). This is execution strategy.*

```markdown
### Include both per-second and per-minute rate limits
**Reasoning:** Different operations have different costs.
```
*Fails: This is a research finding about APIs. No decision made. Belongs in knowledge note.*

```markdown
### One agent per client with independent work
**Expected:** Clean client folders, each agent returns only relevant summary.
```
*Fails: "Expected" is speculation. Also just describes what happened, not why or what alternative was rejected.*
</examples>

<format>
Minimal. The reasoning is what matters.

```markdown
### {Choice made - implies alternative rejected}
**Reasoning:** {Why this over that - 1-3 sentences}
```

For mistakes that revealed insight:
```markdown
### {What to do differently}
**Reasoning:** {What we tried, why it failed}
**Trigger:** {When this applies}
```

**Never include:**
- "Expected:" fields (speculation)
- "What Happened:" sections (logs)
- Bullet lists of everything done (execution details)
</format>

<learnings_guidance>
If a decision reveals that a skill should be improved, note the target:

```markdown
## Learnings
- email-draft skill: Add rate limiting awareness to prevent API throttling
- create-skill: Include context budget in skill schema
```

This connects traces to actionable skill improvements.
</learnings_guidance>

<target_field>
When a trace clearly points to something that should change, add `target` to frontmatter:

```yaml
target: skill:content-ideation  # Edit existing skill
target: skill:new:voice-loader  # Create new skill
target: claude-md               # Edit CLAUDE.md
target: hook:validate-schema    # Edit hook
target: process                 # Can't be codified, just a learning
```

**Use target when:**
- The decision reveals a specific component that should improve
- You know WHAT should change, even if not exactly HOW

**Skip target when:**
- The insight is general/cross-cutting
- You're not sure which component applies
- The /calibrate agents will discover the target through pattern analysis
</target_field>

<process>
1. **Filter ruthlessly** - Apply litmus test to each potential decision
2. **Create trace** at `brain/traces/YYYY-MM-DD-{slug}.md` only if decisions pass
3. **Write decisions** - Focus on reasoning, not narrative
4. **Skip if empty** - "No meaningful decisions" is a valid outcome. Don't create empty traces.

**Quality bar:** Would you want to read this trace in 6 months? If not, don't write it.
</process>

<success_criteria>
A trace succeeds when:
- Every decision passes the 3-question litmus test
- No execution logs, research findings, or speculation
- Future agent would act differently after reading it
- File is under 50 lines (brevity forces quality)
</success_criteria>
