# Context Budget Patterns

Every skill should declare its expected context cost so orchestrators can plan.

## Declaring Context Budget

Add to skill frontmatter:

```yaml
context_budget:
  skill_md: 150        # Max lines in SKILL.md
  max_references: 4    # How many refs might load in worst case
  sub_agent_limit: 400 # Words per sub-agent response (orchestrators)
```

## Line Limits by Archetype

| Archetype | SKILL.md | References | Workflows |
|-----------|----------|------------|-----------|
| Simple | 150 | - | - |
| Router | 200 | 300 each | 200 each |
| Orchestrator | 200 | 300 each | 200 each |
| Reference | 100 | 300 each | - |

## Token Estimation

Rough conversion (varies by content):
- 1 line ≈ 10-15 tokens
- 100 lines ≈ 1,000-1,500 tokens
- 200 lines ≈ 2,000-3,000 tokens

## Budget Planning for Orchestrators

When spawning sub-agents, budget their returns:

```
Orchestrator context budget:
├── SKILL.md: ~2,000 tokens
├── Workflow: ~1,500 tokens
├── References: ~3,000 tokens (2 refs)
├── Sub-agent results: ~2,500 tokens (5 agents × 500 words)
└── Working space: ~3,000 tokens
Total: ~12,000 tokens (well under 200k limit)
```

**Without sub-agent isolation:**
```
├── Raw API response 1: ~5,000 tokens
├── Raw API response 2: ~8,000 tokens
├── Raw file reads: ~10,000 tokens
└── Total: ~23,000+ tokens (and growing)
```

## Sub-Agent Word Limits

Default: 400 words (~600 tokens)

Adjust based on:
- How much detail is needed
- How many sub-agents will run
- Complexity of synthesis

```
| Agent Purpose | Suggested Limit |
|---------------|-----------------|
| Simple lookup | 200 words |
| Summary/analysis | 400 words |
| Detailed research | 600 words |
| Complex synthesis | 800 words |
```

## When to Split

**Upgrade to router when:**
- Simple skill exceeds 150 lines
- Multiple distinct use cases emerge
- Content is reusable across scenarios

**Add sub-agents when:**
- Gathering from 3+ sources
- Raw responses exceed 2,000 tokens each
- Context isolation improves quality

## Enforcement

Context budget is advisory, not enforced. But:

1. **Audit workflow** checks compliance
2. Over-budget skills load slower
3. Orchestrators may fail with bloated skills
4. User experience degrades

## Example Budget Declaration

```yaml
---
name: linkedin-post
description: Create LinkedIn posts with multi-agent research...
context_budget:
  skill_md: 150
  max_references: 4
  sub_agent_limit: 400
---
```

This tells orchestrators:
- SKILL.md is ~150 lines (~1,500 tokens)
- Might load up to 4 references (~4,000 tokens)
- Sub-agents will return max 400 words each (~600 tokens)
