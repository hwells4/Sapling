Completed **Sapling-k1s: Implement vault writer for artifacts**

**Summary:**
- Created `VaultWriter` class in `src/services/vault-writer.ts`
- Writes artifacts to `brain/outputs/YYYY/MM/<run_id>_<slug>.md`
- Includes YAML frontmatter (run_id, agent, source, created_at, status, type)
- Features: atomic writes, collision protection, filename normalization
- Returns `ArtifactManifest` with checksum and metadata
- Exported via `src/services/index.ts`
