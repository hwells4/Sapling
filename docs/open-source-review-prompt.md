# Sapling Open Source Readiness Review

## What is Sapling?

A personal knowledge operating system built on Claude Code + Obsidian that learns user preferences over time. Core loop: `/task` → decisions traced → `/calibrate` → skills improve.

## Review Focus Areas

Analyze Sapling with fresh eyes. For each area, generate specific, actionable ideas:

### 1. Reliability & Robustness
- Error handling gaps
- Edge cases in skills/commands
- Schema validation coverage
- State management issues
- Crash recovery patterns

### 2. Usability & Onboarding
- First-time user experience (`/onboard`)
- Documentation completeness
- Command discoverability
- Error messages quality
- Learning curve reduction

### 3. Elegance & Code Quality
- Redundant or overcomplicated patterns
- Naming inconsistencies
- Architecture simplifications
- Dead code or unused features
- CLAUDE.md clarity

### 4. Agent-Native Design
- Can agents use every feature humans can?
- Are outputs machine-readable?
- Tool integrations (beads, git, obsidian)
- Context management patterns
- Multi-agent coordination

### 5. Power & Capabilities
- Missing "obvious" features
- Third-party integrations to add:
  - QMD (quick markdown search)
  - ngrok/webhook skills
  - Calendar/scheduling
  - Email/communication
  - Other productivity tools
- Pipeline/automation skills
- Advanced query capabilities

### 6. Developer Experience
- Contributing guide
- Testing setup
- Local development workflow
- Extension points
- Plugin architecture potential

### 7. Open Source Readiness
- License clarity
- Sensitive data in repo
- Generic vs personal content
- Example/template content
- Security considerations

## Constraints
- Keep suggestions concrete and implementable
- Prioritize high-impact, low-effort wins
- Consider both human and agent users
- Think about the 80% use case first
