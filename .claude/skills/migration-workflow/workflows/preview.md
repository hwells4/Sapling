<required_reading>
- references/migration-maps.md
- references/detection-logic.md
</required_reading>

<objective>
Show before/after diff for a specific file's migration. No changes applied.
</objective>

<when_to_use>
- User wants to see what migration will change for a specific file
- Before applying migration to review transformations
</when_to_use>

<process>
1. **Read current file** [rigid]
   - Extract frontmatter
   - Identify current version (or legacy)
   - Note body content (will be preserved)

2. **Determine migration path** [rigid]
   Based on migration-maps.md:
   - legacy → current version
   - 1.0.0 → current version
   - etc.

3. **Generate new frontmatter** [rigid]
   Apply transformation rules:
   - Map old fields to new structure
   - Add required fields (schema_version, type, origin)
   - Remove deprecated fields
   - Update tag format

4. **Show diff** [flexible]
   Display side-by-side or unified diff:
   ```
   File: brain/library/posts/vibe-coding.md
   Migration: legacy → 1.2.0
   ─────────────────────────────────────

   --- Original frontmatter
   +++ Migrated frontmatter

   -author: "[[entities/people/alex-lieberman|Alex Lieberman]]"
   -date: 2025-12-17
   -post_url: https://www.linkedin.com/feed/update/...
   -post_type: text
   -reactions: 38
   -comments: 15
   -tags: [linkedin-example, ai-tools, vibe-coding]
   +schema_version: 1.2.0
   +date: 2025-12-17
   +type: library
   +origin: external
   +source:
   +  url: https://www.linkedin.com/feed/update/...
   +  author: Alex Lieberman
   +  format: post
   +  platform: linkedin
   +topics: [ai-tools, vibe-coding]
   +tags: [date/2025-12-17, library, library/external, topic/ai-tools]

   Body content: unchanged (21 lines)
   ```

5. **Prompt for action** [flexible]
   Ask: "Apply this migration? [y/n/next]"
</process>

<success_criteria>
- [ ] Original frontmatter shown
- [ ] New frontmatter shown
- [ ] Diff is clear and readable
- [ ] Body content confirmed unchanged
</success_criteria>
