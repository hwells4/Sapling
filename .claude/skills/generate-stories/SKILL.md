---
name: generate-stories
description: Generate stories from a PRD for autonomous or assisted execution. Use when user says "generate tasks", "break this down", "create stories", or has a PRD they want to execute.
context_budget:
  skill_md: 200
  max_references: 1
---

## MANDATORY TOOL USAGE

**ALL clarifying questions MUST use the `AskUserQuestion` tool.**

Never output questions as text in your response. If you need information, invoke `AskUserQuestion`.

## What This Skill Produces

A `prd.json` file with stories that an agent (autonomous or assisted) can execute:

```json
{
  "branchName": "feature/feature-name",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title",
      "acceptanceCriteria": [
        "Criterion that can be verified",
        "Test: specific test case",
        "npm test passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Process

### 1. Find the PRD

Check `brain/outputs/` for PRDs. If multiple exist, use `AskUserQuestion` to ask which one.

If no PRD exists, ask if they want to:
- A) Create a PRD first (invoke `/prd` skill)
- B) Describe the feature now (you'll ask clarifying questions)

### 2. Analyze the PRD

Read the PRD and identify:
- All features that need to be built
- Acceptance criteria from the PRD
- Technical approach / integrations
- Test strategy mentioned

### 3. Phase 1: Generate Story List

Break the PRD into stories. Each story should be:
- **Small enough** for one agent session (one context window)
- **Self-contained** - can be implemented and verified independently
- **Verifiable** - has clear done criteria

Present the story list to the user:

```
## Stories

1. US-001: [Title] (Priority 1)
2. US-002: [Title] (Priority 2)
3. US-003: [Title] (Priority 3)
...

Reply "Go" to generate acceptance criteria, or suggest changes.
```

**Wait for user to say "Go"** before proceeding.

### 4. Phase 2: Generate Acceptance Criteria

For each story, generate acceptance criteria that:
- Are specific and verifiable
- Include test cases (prefix with "Test:")
- Include verification commands (npm test, typecheck, etc.)
- An agent can objectively determine pass/fail

**Good criteria:**
```
- Function validates email format using regex
- Test: rejects 'invalid' (no @ symbol)
- Test: rejects 'user@' (no domain)
- Test: accepts 'user@domain.com'
- npm test passes
- typecheck passes
```

**Bad criteria:**
```
- Email validation works well
- Tests are written
- Code is clean
```

### 5. Ask About Verification Commands

Use `AskUserQuestion` to confirm:
- What test command? (npm test, pytest, etc.)
- What typecheck command? (tsc, pyright, etc.)
- Any other verification? (ubs, lint, etc.)

### 6. Generate prd.json

Create the file at `scripts/autonomous/prd.json` (or ask where if project-specific).

Include:
- `branchName` based on feature name
- All stories with acceptance criteria
- Priority order (dependencies first)
- All `passes: false` initially

### 7. Confirm Output

Show the user:
- Path to generated file
- Number of stories
- Suggested next step: `./autonomous-once.sh` to test one iteration

## Story Sizing Guidelines

A story is too big if:
- It touches more than 3-4 files
- It requires multiple unrelated changes
- You can't describe it in one sentence

A story is too small if:
- It's just "create a file"
- It can't be meaningfully tested
- It's a sub-step of something else

## Success Criteria

- [ ] Found or created PRD to work from
- [ ] Generated story list and got user "Go"
- [ ] Every acceptance criterion is objectively verifiable
- [ ] Test cases are explicit (not "write tests")
- [ ] Verification commands included
- [ ] prd.json saved and valid JSON
