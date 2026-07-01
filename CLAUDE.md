# Claude Compatibility Shim

Sapling's canonical agent instructions live in `AGENTS.md`. Read and follow that file first.

Claude-specific notes:

- Slash commands live in `.claude/commands/`.
- Hooks live in `.claude/hooks/` and are part of normal Sapling behavior when installed.
- Legacy Claude skills live in `.claude/skills/`.
- The shared Sapling brain skill is `.claude/skills/sapling-brain/SKILL.md`; keep it aligned with the Codex and Pi copies.

Core loop:

1. Capture source context in `brain/raw/`.
2. Promote durable business knowledge into `brain/wiki/`.
3. Run active work from `brain/ops/`.
4. Save deliverables in `brain/outputs/`.
5. Track multi-session work with beads.

If old context refers to `brain/logs/`, `brain/entities/`, `brain/calls/`, `brain/library/`, or `brain/context/`, treat those as legacy paths. Prefer the new `raw/wiki/ops/outputs` structure for new work.
