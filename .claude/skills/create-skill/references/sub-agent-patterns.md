# Sub-Agent Patterns

How to use sub-agents for context isolation, based on the client-context skill.

## The Core Pattern

**Problem:** Gathering context from multiple sources bloats the orchestrator's context.
- Raw API responses: 5,000+ tokens each
- Multiple file reads: accumulates quickly
- Orchestrator can't think clearly with noise

**Solution:** Sub-agents with word limits.
- Each agent gets clean context
- Returns ONLY a summary (400-500 words)
- Orchestrator receives condensed insights
- 5x-10x context savings

## Sub-Agent Definition Structure

Define in `references/sub-agents.md`:

```markdown
## {Agent Name}

**Purpose:** One sentence describing what this agent does.

**When to spawn:** Conditions that trigger this agent.

**Tools required:** List of tools the agent needs.

**Prompt template:**
```
You are a {role} gathering {what} for {purpose}.

Your task:
1. {Step 1}
2. {Step 2}
3. {Step 3}

Return ONLY:
- {Output format point 1}
- {Output format point 2}
- {Output format point 3}

Maximum: {word_limit} words. Be concise.
```

**Output handling:** How the orchestrator uses this agent's output.
```

## Example: Library Search Agent

```markdown
## Library Search Agent

**Purpose:** Find relevant examples from library/posts/.

**When to spawn:** User wants to create content and similar examples exist.

**Tools required:** Glob, Grep, Read

**Prompt template:**
```
You are a library research agent finding relevant post examples.

Search library/posts/ for posts related to: {topic}

Your task:
1. Search for keyword matches in filenames and content
2. Read the top 3-5 most relevant posts
3. Extract what made each effective

Return ONLY:
- List of relevant posts found (with paths)
- Key patterns observed (hooks, structure, voice)
- Specific phrases or approaches worth reusing

Maximum: 400 words. Focus on actionable insights.
```

**Output handling:** Writing agent uses these patterns as inspiration.
```

## Example: Call Search Agent

```markdown
## Call Search Agent

**Purpose:** Find call notes with relevant discussions.

**When to spawn:** Topic might have been discussed in client/team calls.

**Tools required:** Grep, Read

**Prompt template:**
```
You are a call research agent finding relevant discussions.

Search brain/calls/ for calls tagged with or mentioning: {topic}

Your task:
1. Search call notes for topic mentions
2. Read relevant sections of matching calls
3. Extract key points, quotes, or insights

Return ONLY:
- Which calls mentioned this topic
- Key quotes or insights (with attribution)
- Any decisions or conclusions reached

Maximum: 400 words. Include specific quotes.
```

**Output handling:** Provides real-world context for content.
```

## Orchestration Flow

Multi-agent coordination uses Task tools natively: TaskCreate for dependencies, TeamCreate for teams, SendMessage for communication.

```
Phase 1: Parallel Spawn
├── Library Agent → searches library/posts/
├── Call Agent → searches brain/calls/
└── Style Agent → reviews voice patterns

Phase 2: Coordination (optional)
├── Agents communicate via SendMessage
├── Adapt based on others' findings
└── Resolve conflicts or gaps

Phase 3: Synthesis
├── Orchestrator reads all summaries
├── Combines into unified context
└── Identifies key themes/patterns

Phase 4: Execution
├── Final agent receives synthesized context
├── Produces output
└── Context is clean and focused

Phase 5: Validation (if needed)
├── Validation agent checks output
├── Reports issues
└── Orchestrator decides next step
```

## Parallel vs Sequential

**Parallel** when:
- Sources are independent
- No agent needs another's output
- Speed matters

```python
# Spawn simultaneously
spawn([library_agent, call_agent, style_agent])
wait_all()
```

**Sequential** when:
- Later agents need earlier results
- Output depends on intermediate findings

```python
# First gather, then analyze
results = spawn(gather_agent)
spawn(analyze_agent, context=results)
```

## Word Limit Guidelines

| Agent Type | Suggested Limit |
|------------|-----------------|
| Simple lookup | 200 words |
| Search + summarize | 400 words |
| Analysis | 500 words |
| Complex research | 600 words |

**Rule of thumb:** If agent needs >600 words, split into multiple agents.

## Common Mistakes

**No word limit:**
```
<!-- Bad -->
Return your findings.

<!-- Good -->
Maximum: 400 words. Be concise.
```

**Vague output format:**
```
<!-- Bad -->
Return what you found.

<!-- Good -->
Return ONLY:
- List of files found
- Key patterns observed
- Recommended approaches
```

**Not using parallel spawning:**
```python
# Bad: Sequential when parallel is possible
result1 = spawn(agent1)
result2 = spawn(agent2)
result3 = spawn(agent3)

# Good: Parallel
results = spawn([agent1, agent2, agent3])
```
