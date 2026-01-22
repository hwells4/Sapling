Done. I completed **Sapling-23x: Implement trace writer**.

**Summary:**
- Created `src/services/trace-writer.ts` with `TraceWriter` class
- Writes `brain/traces/YYYY/MM/<run_id>.md` with YAML frontmatter (run_id, template, goal, started_at, finished_at, outcome, cost_cents)
- Writes companion `.jsonl` file for detailed events including:
  - Contract snapshot
  - Phase start/end entries with duration
  - Tool call and result entries
  - Error and recovery entries
  - Calibration seeds
  - Run completion/failure entries
- Markdown trace includes human-readable sections: Contract Summary, Outcome, Phase Summary table, Decisions Log, Errors & Recoveries, Calibration Notes
- Uses atomic writes (write to .tmp, then rename)
- Exported from `src/services/index.ts`
