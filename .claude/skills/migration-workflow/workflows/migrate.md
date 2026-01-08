<required_reading>
- schemas/migrations/{schema}-{from_version}-to-{to_version}.md
</required_reading>

<objective>
Apply migration transformations to files. Supports single file, batch, or interactive modes.
</objective>

<when_to_use>
- After detect workflow identifies files needing migration
- User confirms they want to apply changes
</when_to_use>

<modes>
| Mode | Trigger | Behavior |
|------|---------|----------|
| Single | Specific file path | Migrate one file |
| Batch | `--apply` or "migrate all" | Migrate all detected files |
| Interactive | Default | Preview each, prompt for confirmation |
</modes>

<process>
1. **Get files to migrate** [rigid]
   Either:
   - Single file from user
   - List from detect workflow
   - Re-run detect if not already done

2. **For each file** [rigid]

   a. **Read file**
      - Extract frontmatter and body
      - Identify current version

   b. **Transform frontmatter**
      Apply rules from `schemas/migrations/{schema}-{from}-to-{to}.md`:
      - Add schema_version (current)
      - Restructure fields per schema
      - Remove deprecated fields
      - Update tags to required format

   c. **Reconstruct file**
      ```
      ---
      {new frontmatter as YAML}
      ---
      {original body unchanged}
      ```

   d. **Write file**
      Use Edit tool to replace entire content

   e. **Validate** [rigid]
      The validation hook will check:
      - Required fields present
      - Date format correct
      - Schema structure valid

3. **Report results** [flexible]
   ```
   Migration complete
   ─────────────────
   ✓ brain/library/posts/vibe-coding.md (legacy → 1.2.0)
   ✓ brain/library/posts/ai-agents-2025.md (legacy → 1.2.0)
   ...

   Migrated: 14 files
   Errors: 0
   ```
</process>

<transformation_examples>

## Legacy Post → Library 1.2.0

**Input:**
```yaml
author: "[[entities/people/alex-lieberman|Alex Lieberman]]"
date: 2025-12-17
post_url: https://www.linkedin.com/feed/update/urn:li:activity:7406406084132749312/
post_type: text
reactions: 38
comments: 15
reposts: 0
tags: [linkedin-example, ai-tools, vibe-coding, webinar-promotion]
```

**Output:**
```yaml
schema_version: 1.2.0
date: 2025-12-17
type: library
origin: external
source:
  url: https://www.linkedin.com/feed/update/urn:li:activity:7406406084132749312/
  author: Alex Lieberman
  format: post
  platform: linkedin
topics: [ai-tools, vibe-coding, webinar-promotion]
tags: [date/2025-12-17, library, library/external, topic/ai-tools, topic/vibe-coding]
```

**Rules applied:**
- Extract author name from wikilink display text
- Map post_url → source.url
- Map post_type: text → source.format: post
- Infer platform from URL domain
- Remove reactions, comments, reposts
- Convert topic tags to topics array
- Add required date/ and library/ tag prefixes

## Library 1.0.0 → 1.2.0

**Input:**
```yaml
schema_version: 1.0.0
date: 2025-12-26
type: library
source_type: article
author: Harrison Wells
topics: [zapier, supabase, postgres, troubleshooting]
tags: [date/2025-12-26, library, library/article]
status: working
last_verified: 2025-12-26
```

**Output:**
```yaml
schema_version: 1.2.0
date: 2025-12-26
type: library
origin: external
source:
  author: Harrison Wells
  format: article
topics: [zapier, supabase, postgres, troubleshooting]
tags: [date/2025-12-26, library, library/external, topic/zapier, topic/supabase]
```

**Rules applied:**
- Update schema_version to 1.2.0
- Add origin: external (articles are external content)
- Convert source_type to source.format
- Move author to source.author
- Remove deprecated: status, last_verified
- Update tags: library/article → library/external
</transformation_examples>

<success_criteria>
- [ ] All targeted files migrated
- [ ] Files pass validation hook
- [ ] Body content preserved exactly
- [ ] Clear success/error report
</success_criteria>
