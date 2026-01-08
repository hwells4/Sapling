<required_reading>
- references/detection-logic.md
</required_reading>

<objective>
Find all files that need migration for a given schema. Show version status and migration path.
</objective>

<when_to_use>
- User runs `/migrate {schema}` (first step)
- User asks "what needs migration"
- User asks about schema status
</when_to_use>

<process>
1. **Get schema info** [rigid]
   - Read schema file from schemas/vault/{schema}.yaml
   - Extract current schema_version from file
   - Note the changelog for version history

2. **Find target files** [rigid]
   Use Glob to find files:
   ```
   library → brain/library/**/*.md
   trace → brain/traces/*.md
   entity → brain/entities/*.md
   call → brain/calls/*.md
   output → brain/outputs/*.md
   inbox → brain/inbox/*.md
   ```

3. **Check each file's version** [rigid]
   For each file:
   - Read frontmatter
   - Check schema_version field
   - If missing, identify as "legacy" and check for known field patterns
   - Compare to current version

4. **Categorize results** [rigid]
   Group files by status:
   - `current` - Already at current version
   - `outdated` - Has schema_version but not current
   - `legacy` - No schema_version, old format

5. **Report findings** [flexible]
   Show summary:
   ```
   Schema: {schema} (current: {version})
   ─────────────────────────────────────
   Legacy files: {count}
   Outdated files: {count} (versions: {list})
   Current files: {count}

   Files needing migration:
   - {file}: legacy → {version}
   - {file}: {old} → {version}

   Run `/migrate {schema} --apply` to migrate all
   Or proceed to review individual files
   ```
</process>

<success_criteria>
- [ ] All files in target folder checked
- [ ] Version status correctly identified
- [ ] Legacy files detected by field patterns
- [ ] Clear summary of migration needed
</success_criteria>
