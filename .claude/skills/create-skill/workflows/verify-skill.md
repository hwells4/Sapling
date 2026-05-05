<required_reading>
- references/core-principles.md
</required_reading>

<objective>
Verify that a skill's content is still accurate. Skills reference external APIs, CLI tools, and frameworks that change over time.
</objective>

<process>
1. **Select skill** [LOW freedom]
   ```bash
   ls ~/.claude/skills/
   ```
   Ask which skill to verify.

2. **Read and categorize** [MEDIUM freedom]
   Read entire skill (SKILL.md + workflows/ + references/).

   Categorize by dependency type:
   | Type | Examples | Verification Method |
   |------|----------|---------------------|
   | API/Service | Attio, Stripe | Context7 + WebSearch |
   | CLI Tools | git, npm | Run commands |
   | Framework | Rails, React | Context7 docs |
   | Pure Process | decision-traces | No external deps |

3. **Extract verifiable claims** [MEDIUM freedom]
   Scan for:
   - CLI tools and specific flags
   - API endpoints and auth methods
   - Framework APIs and patterns
   - File paths and structures

4. **Verify by type** [LOW freedom]

   **CLI Tools:**
   ```bash
   which {tool} && {tool} --version
   {tool} --help | grep "{documented-flag}"
   ```

   **API/Service:**
   ```
   mcp__context7__resolve-library-id: {service-name}
   mcp__context7__get-library-docs: {library-id}, topic: {feature}
   ```

   **Framework:**
   Use Context7 for current docs. Check if patterns have changed.

5. **Generate freshness report** [LOW freedom]
   ```
   ## Verification Report: {skill-name}

   ### Verified Current
   - [Claim]: [Evidence]

   ### May Be Outdated
   - [Claim]: [What changed]
     Current: [what docs now say]

   ### Broken / Invalid
   - [Claim]: [Why wrong]
     Fix: [correction]

   **Overall Status:** Fresh / Needs Updates / Stale
   **Verified:** {date}
   ```

6. **Offer updates** [HIGH freedom]
   If issues found, offer:
   1. Update all
   2. Review each change
   3. Just the report

7. **Recommend re-verification** [LOW freedom]
   | Skill Type | Frequency |
   |------------|-----------|
   | API/Service | 1-2 months |
   | Framework | 3-6 months |
   | CLI Tools | 6 months |
   | Pure Process | Annually |
</process>

<success_criteria>
- [ ] Skill categorized by dependency type
- [ ] Verifiable claims extracted
- [ ] Each claim checked with appropriate method
- [ ] Freshness report generated
- [ ] User knows when to re-verify
</success_criteria>
