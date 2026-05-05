<required_reading>
- references/core-principles.md
- templates/workflow-file.md
</required_reading>

<objective>
Add a new workflow to an existing router or orchestrator skill.
</objective>

<process>
1. **Read existing skill**
   - Read SKILL.md to understand current structure
   - List existing workflows
   - Identify what references exist

2. **Gather requirements**
   - What does this new workflow do?
   - What's different from existing workflows?
   - Which existing references does it need?
   - Does it need new references?

3. **Write the workflow**
   Create `workflows/{new-workflow}.md`:
   - Start with `<required_reading>` (existing refs + any new)
   - Write objective
   - Write process with appropriate freedom levels
   - Write success_criteria

4. **Update SKILL.md routing**
   Add entry to routing table:
   ```
   | New intent | workflows/new-workflow.md |
   ```

5. **Create any new references needed**
   - Keep under 300 lines
   - Add to references_index in SKILL.md

6. **Validate**
   - [ ] Workflow has required_reading
   - [ ] SKILL.md routing updated
   - [ ] New references indexed
   - [ ] Doesn't duplicate existing workflows
</process>

<success_criteria>
- [ ] Workflow file created
- [ ] SKILL.md routing table updated
- [ ] Any new references created and indexed
- [ ] Consistent with existing skill structure
</success_criteria>
