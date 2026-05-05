# Sub-Agent Definition Template

Use this structure for each sub-agent in `references/sub-agents.md`.

---

```markdown
## {Agent Name}

**Purpose:** {One sentence - what this agent does}

**When to spawn:** {Conditions that trigger spawning this agent}

**Tools required:** {Comma-separated list: Read, Grep, Glob, etc.}

**Input parameters:**
- `{param1}`: {Description}
- `{param2}`: {Description}

**Prompt template:**
```
You are a {role} agent {doing what} for {purpose}.

Context:
- {Relevant context point 1}
- {Relevant context point 2}

Your task:
1. {Specific step 1}
2. {Specific step 2}
3. {Specific step 3}

Return ONLY:
- {Output format point 1}
- {Output format point 2}
- {Output format point 3}

Maximum: {word_limit} words. Be concise and actionable.
```

**Output handling:**
{How the orchestrator uses this agent's output}
{What happens next}
```

---

## Example: Library Search Agent

```markdown
## Library Search Agent

**Purpose:** Find relevant examples from the library.

**When to spawn:** User wants to create content and similar examples might exist.

**Tools required:** Glob, Grep, Read

**Input parameters:**
- `topic`: The topic to search for
- `content_type`: Type of content (post, article, etc.)

**Prompt template:**
```
You are a library research agent finding relevant examples.

Search library/{content_type}s/ for content related to: {topic}

Your task:
1. Search for keyword matches in filenames and content
2. Read the top 3-5 most relevant files
3. Extract what made each effective (hooks, structure, voice)

Return ONLY:
- List of relevant files found (with paths)
- Key patterns observed across examples
- Specific phrases or approaches worth adapting

Maximum: 400 words. Focus on actionable insights, not summaries.
```

**Output handling:**
The orchestrator passes these patterns to the writing agent as inspiration.
Do not copy directly - adapt the patterns.
```

---

## Word Limit Guidelines

| Agent Complexity | Suggested Limit |
|------------------|-----------------|
| Simple lookup | 200 words |
| Search + analyze | 400 words |
| Complex research | 600 words |
| Synthesis | 600-800 words |

**Rule:** If an agent needs >600 words, consider splitting into multiple agents.

---

## Common Agent Types

**Research agents:**
- Library search
- File/folder exploration
- API data gathering
- Web search

**Analysis agents:**
- Pattern recognition
- Style analysis
- Content comparison

**Synthesis agents:**
- Combine multiple sources
- Resolve conflicts
- Prioritize insights

**Validation agents:**
- Quality checks
- Rule enforcement
- Output review
