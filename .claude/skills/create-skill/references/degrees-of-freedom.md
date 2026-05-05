# Degrees of Freedom

Match instruction specificity to how fragile the operation is.

## The Three Levels

| Level | Specificity | Use When |
|-------|-------------|----------|
| **High** | Principles and goals only | Creative tasks, multiple valid outcomes |
| **Medium** | Preferred patterns with flexibility | Standard work, established conventions |
| **Low** | Exact scripts, no deviation | Fragile operations, consistency critical |

## High Freedom

**Give principles, not procedures.**

```xml
<process>
Write a LinkedIn post that:
- Opens with a hook (question, bold claim, or story)
- Delivers value in the body
- Ends with engagement (question or CTA)
- Matches the voice in references/voice-and-style.md
</process>
```

**Use for:**
- Creative writing
- Design decisions
- Strategy recommendations
- Any task with multiple valid approaches

**Why:** Over-specifying creative work produces generic output. Claude does better with constraints than scripts.

## Medium Freedom

**Give patterns with flexibility.**

```xml
<process>
1. Search for existing posts on similar topics
   - Check library/posts/ first
   - Then search outputs/linkedin/
   - Return up to 5 relevant examples

2. Analyze what made them successful
   - Note: hook style, structure, engagement

3. Apply patterns to new topic
   - Adapt, don't copy
</process>
```

**Use for:**
- Standard workflows
- Following established conventions
- Tasks with preferred but flexible approaches

**Why:** Provides guidance without being prescriptive. Claude can adapt to context.

## Low Freedom

**Give exact scripts with no wiggle room.**

```xml
<process>
Run these exact commands:

1. Stage changes:
   ```bash
   git add -A
   ```

2. Create commit:
   ```bash
   git commit -m "$(cat <<'EOF'
   {commit_message}
   EOF
   )"
   ```

3. Push to remote:
   ```bash
   git push origin {branch}
   ```

Do not modify these commands.
</process>
```

**Use for:**
- Git operations
- API calls with specific formats
- File operations with exact paths
- Anything where consistency is critical
- Operations that could cause damage if wrong

**Why:** Some operations must be exact. Flexibility here causes bugs.

## Classifying Operations

When writing a skill, classify each step:

```xml
<process>
1. [HIGH] Decide on post topic based on user input

2. [LOW] Search library/posts/ with exact query:
   ```bash
   grep -r "{topic}" library/posts/
   ```

3. [MEDIUM] Analyze successful patterns from results

4. [HIGH] Write the post using gathered context

5. [LOW] Run validation checks:
   - [ ] No em dashes (—)
   - [ ] No "Here's the thing:"
   - [ ] Under 3000 characters
</process>
```

## Model Considerations

Different models need different freedom levels:

| Model | Tendency | Adjustment |
|-------|----------|------------|
| Haiku | Needs more guidance | Lower freedom, more explicit |
| Sonnet | Balanced | Standard freedom levels |
| Opus | Works with principles | Higher freedom, less prescription |

**Best practice:** Write for Sonnet (medium), test with Haiku (catches under-specification) and Opus (catches over-specification).

## Common Mistakes

**Over-specification of creative tasks:**
```xml
<!-- Bad -->
<process>
Write exactly 5 paragraphs.
Paragraph 1: Hook with question.
Paragraph 2: Problem statement.
...
</process>

<!-- Good -->
<process>
Write a post that hooks, delivers value, and drives engagement.
Match the voice in references/voice-and-style.md.
</process>
```

**Under-specification of fragile operations:**
```xml
<!-- Bad -->
<process>
Commit the changes to git.
</process>

<!-- Good -->
<process>
Run: git add -A && git commit -m "{message}"
Do not use --force or --amend.
</process>
```

## Summary

1. Classify each operation as high/medium/low freedom
2. Match specificity to fragility
3. Creative = high freedom (principles)
4. Mechanical = low freedom (scripts)
5. Test across models to verify calibration
