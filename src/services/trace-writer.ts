import * as fs from 'fs/promises'
import * as path from 'path'
import type { Run, RunContract, Event, Phase } from '../types'

/**
 * JSONL trace entry types for detailed event logging
 */
export type TraceEntryType =
  | 'contract'
  | 'phase_start'
  | 'phase_end'
  | 'decision'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'recovery'
  | 'calibration_seed'
  | 'run_complete'
  | 'run_failed'

/**
 * Base trace entry envelope
 */
export interface TraceEntry {
  type: TraceEntryType
  timestamp: string
  data: Record<string, unknown>
}

/**
 * Contract snapshot entry
 */
export interface ContractEntry extends TraceEntry {
  type: 'contract'
  data: {
    goal: string
    success_criteria: RunContract['success_criteria']
    deliverables: RunContract['deliverables']
    constraints: RunContract['constraints']
    tool_policy: RunContract['tool_policy']
    max_duration_seconds: number
    max_cost_cents?: number
  }
}

/**
 * Phase transition entries
 */
export interface PhaseStartEntry extends TraceEntry {
  type: 'phase_start'
  data: {
    phase: Phase
    from_phase: Phase | null
  }
}

export interface PhaseEndEntry extends TraceEntry {
  type: 'phase_end'
  data: {
    phase: Phase
    duration_ms: number
  }
}

/**
 * Decision record for calibration
 */
export interface DecisionEntry extends TraceEntry {
  type: 'decision'
  data: {
    phase: Phase
    action: string
    rationale: string
    alternatives?: string[]
  }
}

/**
 * Tool call summary
 */
export interface ToolCallEntry extends TraceEntry {
  type: 'tool_call'
  data: {
    tool_name: string
    input_summary: string
    phase: Phase
  }
}

/**
 * Tool result summary
 */
export interface ToolResultEntry extends TraceEntry {
  type: 'tool_result'
  data: {
    tool_name: string
    success: boolean
    output_summary: string
    duration_ms: number
    error?: string
  }
}

/**
 * Error record
 */
export interface ErrorEntry extends TraceEntry {
  type: 'error'
  data: {
    error_type: string
    message: string
    phase: Phase
    recoverable: boolean
  }
}

/**
 * Recovery record
 */
export interface RecoveryEntry extends TraceEntry {
  type: 'recovery'
  data: {
    from_error: string
    strategy: string
    success: boolean
  }
}

/**
 * Calibration seed - what to improve next time
 */
export interface CalibrationSeedEntry extends TraceEntry {
  type: 'calibration_seed'
  data: {
    category: 'decision' | 'constraint' | 'tool_policy' | 'template'
    observation: string
    suggestion: string
  }
}

/**
 * Run completion entry
 */
export interface RunCompleteEntry extends TraceEntry {
  type: 'run_complete'
  data: {
    outcome: 'completed' | 'cancelled' | 'timeout'
    deliverables_produced: number
    duration_seconds: number
    cost_cents?: number
  }
}

/**
 * Run failure entry
 */
export interface RunFailedEntry extends TraceEntry {
  type: 'run_failed'
  data: {
    error_type: string
    message: string
    phase: Phase
    partial_deliverables: number
  }
}

/**
 * Phase summary for markdown rendering
 */
export interface PhaseSummary {
  phase: Phase
  started_at: string
  ended_at?: string
  duration_ms?: number
  tool_calls: number
  errors: number
}

/**
 * Options for writing a trace
 */
export interface WriteTraceOptions {
  /** The run to trace */
  run: Run
  /** All events from the run */
  events: Event[]
  /** Optional calibration seeds to include */
  calibration_seeds?: CalibrationSeedEntry['data'][]
  /** Optional outcome summary */
  outcome_summary?: string
}

/**
 * Result of a trace write operation
 */
export interface WriteTraceResult {
  success: boolean
  markdown_path?: string
  jsonl_path?: string
  error?: string
}

/**
 * TraceWriter - writes run traces to the Obsidian vault
 *
 * Outputs two files per run:
 * - brain/traces/YYYY/MM/<run_id>.md - Human-readable markdown wrapper
 * - brain/traces/YYYY/MM/<run_id>.jsonl - Detailed event log
 *
 * A run is not "complete" until the trace exists. This is non-negotiable
 * for the Sapling calibration loop.
 */
export class TraceWriter {
  private readonly vaultPath: string
  private readonly tracesDir: string

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
    this.tracesDir = path.join(vaultPath, 'traces')
  }

  /**
   * Write a trace for a completed (or failed) run
   *
   * @param options - Trace options including run, events, and calibration seeds
   * @returns WriteTraceResult with paths on success
   */
  async writeTrace(options: WriteTraceOptions): Promise<WriteTraceResult> {
    try {
      const { run, events, calibration_seeds, outcome_summary } = options

      // Generate destination paths
      const startDate = run.timestamps.started_at
        ? new Date(run.timestamps.started_at)
        : new Date(run.timestamps.created_at)
      const year = startDate.getFullYear().toString()
      const month = String(startDate.getMonth() + 1).padStart(2, '0')

      const dirPath = path.join(this.tracesDir, year, month)
      const baseName = run.run_id
      const markdownPath = path.join(dirPath, `${baseName}.md`)
      const jsonlPath = path.join(dirPath, `${baseName}.jsonl`)

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true })

      // Build trace entries from events
      const traceEntries = this.buildTraceEntries(run, events, calibration_seeds)

      // Write JSONL file
      const jsonlContent = traceEntries.map((entry) => JSON.stringify(entry)).join('\n')
      await this.atomicWrite(jsonlPath, jsonlContent)

      // Build and write markdown file
      const markdownContent = this.buildMarkdownTrace(run, events, traceEntries, outcome_summary)
      await this.atomicWrite(markdownPath, markdownContent)

      return {
        success: true,
        markdown_path: path.relative(this.vaultPath, markdownPath),
        jsonl_path: path.relative(this.vaultPath, jsonlPath),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  /**
   * Build trace entries from run and events
   */
  private buildTraceEntries(
    run: Run,
    events: Event[],
    calibration_seeds?: CalibrationSeedEntry['data'][],
  ): TraceEntry[] {
    const entries: TraceEntry[] = []
    const now = new Date().toISOString()

    // 1. Contract snapshot
    entries.push({
      type: 'contract',
      timestamp: run.timestamps.created_at,
      data: {
        goal: run.contract.goal,
        success_criteria: run.contract.success_criteria,
        deliverables: run.contract.deliverables,
        constraints: run.contract.constraints,
        tool_policy: run.contract.tool_policy,
        max_duration_seconds: run.contract.max_duration_seconds,
        max_cost_cents: run.contract.max_cost_cents,
      },
    } as ContractEntry)

    // 2. Process events into trace entries
    const phaseStarts: Map<Phase, string> = new Map()

    for (const event of events) {
      switch (event.type) {
        case 'phase.changed': {
          const payload = event.payload as { from_phase: Phase | null; to_phase: Phase }

          // Record phase end if transitioning from a phase
          if (payload.from_phase && phaseStarts.has(payload.from_phase)) {
            const startTime = phaseStarts.get(payload.from_phase)!
            const durationMs = new Date(event.ts).getTime() - new Date(startTime).getTime()
            entries.push({
              type: 'phase_end',
              timestamp: event.ts,
              data: {
                phase: payload.from_phase,
                duration_ms: durationMs,
              },
            } as PhaseEndEntry)
          }

          // Record phase start
          phaseStarts.set(payload.to_phase, event.ts)
          entries.push({
            type: 'phase_start',
            timestamp: event.ts,
            data: {
              phase: payload.to_phase,
              from_phase: payload.from_phase,
            },
          } as PhaseStartEntry)
          break
        }

        case 'tool.called': {
          const payload = event.payload as { tool_name: string; tool_input: Record<string, unknown> }
          entries.push({
            type: 'tool_call',
            timestamp: event.ts,
            data: {
              tool_name: payload.tool_name,
              input_summary: this.summarizeInput(payload.tool_input),
              phase: event.phase,
            },
          } as ToolCallEntry)
          break
        }

        case 'tool.result': {
          const payload = event.payload as {
            tool_name: string
            success: boolean
            output_summary?: string
            error?: string
            duration_ms: number
          }
          entries.push({
            type: 'tool_result',
            timestamp: event.ts,
            data: {
              tool_name: payload.tool_name,
              success: payload.success,
              output_summary: payload.output_summary ?? '',
              duration_ms: payload.duration_ms,
              error: payload.error,
            },
          } as ToolResultEntry)
          break
        }

        case 'run.failed': {
          const payload = event.payload as {
            error_type: string
            error_message: string
            recoverable: boolean
          }
          entries.push({
            type: 'error',
            timestamp: event.ts,
            data: {
              error_type: payload.error_type,
              message: payload.error_message,
              phase: event.phase,
              recoverable: payload.recoverable,
            },
          } as ErrorEntry)
          break
        }

        case 'drift.detected': {
          const payload = event.payload as {
            drift_type: string
            details: string
          }
          entries.push({
            type: 'error',
            timestamp: event.ts,
            data: {
              error_type: `drift:${payload.drift_type}`,
              message: payload.details,
              phase: event.phase,
              recoverable: false,
            },
          } as ErrorEntry)
          break
        }
      }
    }

    // 3. Add calibration seeds
    if (calibration_seeds) {
      for (const seed of calibration_seeds) {
        entries.push({
          type: 'calibration_seed',
          timestamp: now,
          data: seed,
        } as CalibrationSeedEntry)
      }
    }

    // 4. Add run completion/failure entry
    if (run.state === 'completed' || run.state === 'cancelled' || run.state === 'timeout') {
      const durationSeconds = this.calculateDurationSeconds(run)
      entries.push({
        type: 'run_complete',
        timestamp: run.timestamps.completed_at ?? now,
        data: {
          outcome: run.state as 'completed' | 'cancelled' | 'timeout',
          deliverables_produced: run.artifacts.length,
          duration_seconds: durationSeconds,
          cost_cents: run.cost?.total_cents,
        },
      } as RunCompleteEntry)
    } else if (run.state === 'failed') {
      entries.push({
        type: 'run_failed',
        timestamp: run.timestamps.completed_at ?? now,
        data: {
          error_type: run.error?.type ?? 'unknown',
          message: run.error?.message ?? 'Unknown error',
          phase: this.getLastPhase(events),
          partial_deliverables: run.artifacts.length,
        },
      } as RunFailedEntry)
    }

    return entries
  }

  /**
   * Build the markdown trace file
   */
  private buildMarkdownTrace(
    run: Run,
    events: Event[],
    traceEntries: TraceEntry[],
    outcomeSummary?: string,
  ): string {
    const frontmatter = this.buildFrontmatter(run)
    const contractSection = this.buildContractSection(run.contract)
    const outcomeSection = this.buildOutcomeSection(run, events, outcomeSummary)
    const phaseSummary = this.buildPhaseSummary(traceEntries)
    const decisionsSection = this.buildDecisionsSection(traceEntries)
    const errorsSection = this.buildErrorsSection(traceEntries)
    const calibrationSection = this.buildCalibrationSection(traceEntries)

    const sections = [
      frontmatter,
      `# Trace: ${this.getGoalTitle(run.contract.goal)}`,
      '',
      contractSection,
      '',
      outcomeSection,
      '',
      phaseSummary,
      '',
      decisionsSection,
      errorsSection,
      calibrationSection,
    ]

    return sections.filter(Boolean).join('\n')
  }

  /**
   * Build YAML frontmatter
   */
  private buildFrontmatter(run: Run): string {
    const startedAt = run.timestamps.started_at ?? run.timestamps.created_at
    const finishedAt = run.timestamps.completed_at ?? new Date().toISOString()

    const lines = [
      '---',
      `run_id: ${run.run_id}`,
      `template: ${run.template_id}@${run.template_version}`,
      `goal: "${this.escapeYamlString(run.contract.goal)}"`,
      `started_at: ${startedAt}`,
      `finished_at: ${finishedAt}`,
      `outcome: ${run.state}`,
    ]

    if (run.cost?.total_cents !== undefined) {
      lines.push(`cost_cents: ${run.cost.total_cents}`)
    }

    lines.push('---')
    return lines.join('\n')
  }

  /**
   * Build contract summary section
   */
  private buildContractSection(contract: RunContract): string {
    const lines = ['## Contract Summary', '']

    // Goal
    lines.push(`**Goal:** ${contract.goal}`)
    lines.push('')

    // Success criteria
    if (contract.success_criteria.length > 0) {
      lines.push('**Success Criteria:**')
      for (const criterion of contract.success_criteria) {
        lines.push(`- ${criterion.description}`)
      }
      lines.push('')
    }

    // Deliverables
    if (contract.deliverables.length > 0) {
      lines.push('**Expected Deliverables:**')
      for (const deliverable of contract.deliverables) {
        const required = deliverable.required ? '(required)' : '(optional)'
        lines.push(`- ${deliverable.type}: ${deliverable.destination} ${required}`)
      }
      lines.push('')
    }

    // Constraints
    if (contract.constraints.length > 0) {
      lines.push('**Constraints:**')
      for (const constraint of contract.constraints) {
        lines.push(`- ${constraint.description}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Build outcome section
   */
  private buildOutcomeSection(run: Run, events: Event[], summary?: string): string {
    const lines = ['## Outcome', '']

    if (summary) {
      lines.push(summary)
      lines.push('')
    }

    // Artifacts produced
    lines.push(`**Artifacts Produced:** ${run.artifacts.length}`)
    if (run.artifacts.length > 0) {
      for (const artifact of run.artifacts) {
        lines.push(`- ${artifact.type}: ${artifact.path}`)
      }
    }
    lines.push('')

    // Stats
    const toolCalls = events.filter((e) => e.type === 'tool.called').length
    const errors = events.filter((e) => e.severity === 'error').length
    lines.push(`**Tool Calls:** ${toolCalls}`)
    lines.push(`**Errors:** ${errors}`)

    if (run.cost) {
      lines.push(`**Cost:** $${(run.cost.total_cents / 100).toFixed(2)}`)
    }

    return lines.join('\n')
  }

  /**
   * Build phase summary table
   */
  private buildPhaseSummary(entries: TraceEntry[]): string {
    const phaseStats: Map<Phase, { duration_ms: number; tool_calls: number; errors: number }> =
      new Map()

    for (const entry of entries) {
      if (entry.type === 'phase_end') {
        const data = entry.data as PhaseEndEntry['data']
        const existing = phaseStats.get(data.phase) ?? { duration_ms: 0, tool_calls: 0, errors: 0 }
        existing.duration_ms += data.duration_ms
        phaseStats.set(data.phase, existing)
      } else if (entry.type === 'tool_call') {
        const data = entry.data as ToolCallEntry['data']
        const existing = phaseStats.get(data.phase) ?? { duration_ms: 0, tool_calls: 0, errors: 0 }
        existing.tool_calls++
        phaseStats.set(data.phase, existing)
      } else if (entry.type === 'error') {
        const data = entry.data as ErrorEntry['data']
        const existing = phaseStats.get(data.phase) ?? { duration_ms: 0, tool_calls: 0, errors: 0 }
        existing.errors++
        phaseStats.set(data.phase, existing)
      }
    }

    if (phaseStats.size === 0) {
      return ''
    }

    const lines = [
      '## Phase Summary',
      '',
      '| Phase | Duration | Tool Calls | Errors |',
      '|-------|----------|------------|--------|',
    ]

    for (const [phase, stats] of phaseStats) {
      const durationSec = (stats.duration_ms / 1000).toFixed(1)
      lines.push(`| ${phase} | ${durationSec}s | ${stats.tool_calls} | ${stats.errors} |`)
    }

    return lines.join('\n')
  }

  /**
   * Build decisions log section
   */
  private buildDecisionsSection(entries: TraceEntry[]): string {
    const decisions = entries.filter((e) => e.type === 'decision') as DecisionEntry[]

    if (decisions.length === 0) {
      return '\n## Decisions Log\n\n*See trace.jsonl for full tool call details*\n'
    }

    const lines = ['## Decisions Log', '']

    for (const decision of decisions) {
      lines.push(`### ${decision.data.action}`)
      lines.push(`**Phase:** ${decision.data.phase}`)
      lines.push(`**Rationale:** ${decision.data.rationale}`)
      if (decision.data.alternatives && decision.data.alternatives.length > 0) {
        lines.push(`**Alternatives considered:** ${decision.data.alternatives.join(', ')}`)
      }
      lines.push('')
    }

    lines.push('*See trace.jsonl for full tool call details*')
    return lines.join('\n')
  }

  /**
   * Build errors section
   */
  private buildErrorsSection(entries: TraceEntry[]): string {
    const errors = entries.filter((e) => e.type === 'error') as ErrorEntry[]
    const recoveries = entries.filter((e) => e.type === 'recovery') as RecoveryEntry[]

    if (errors.length === 0) {
      return ''
    }

    const lines = ['', '## Errors & Recoveries', '']

    for (const error of errors) {
      lines.push(`### ${error.data.error_type}`)
      lines.push(`**Phase:** ${error.data.phase}`)
      lines.push(`**Message:** ${error.data.message}`)
      lines.push(`**Recoverable:** ${error.data.recoverable ? 'Yes' : 'No'}`)
      lines.push('')
    }

    if (recoveries.length > 0) {
      lines.push('### Recovery Attempts')
      for (const recovery of recoveries) {
        const status = recovery.data.success ? '✓' : '✗'
        lines.push(`- ${status} ${recovery.data.strategy} (from: ${recovery.data.from_error})`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Build calibration notes section
   */
  private buildCalibrationSection(entries: TraceEntry[]): string {
    const seeds = entries.filter((e) => e.type === 'calibration_seed') as CalibrationSeedEntry[]

    if (seeds.length === 0) {
      return '\n## Calibration Notes\n\n*No calibration seeds captured for this run*\n'
    }

    const lines = ['', '## Calibration Notes', '']

    for (const seed of seeds) {
      lines.push(`### ${seed.data.category}`)
      lines.push(`**Observation:** ${seed.data.observation}`)
      lines.push(`**Suggestion:** ${seed.data.suggestion}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Atomic write: write to temp file, then rename
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`
    await fs.writeFile(tmpPath, content, 'utf8')
    await fs.rename(tmpPath, filePath)
  }

  /**
   * Summarize tool input for JSONL
   */
  private summarizeInput(input: Record<string, unknown>): string {
    const keys = Object.keys(input)
    if (keys.length === 0) return '(no input)'
    if (keys.length <= 3) {
      return keys
        .map((k) => {
          const v = input[k]
          if (typeof v === 'string' && v.length > 50) {
            return `${k}: "${v.slice(0, 47)}..."`
          }
          return `${k}: ${JSON.stringify(v)}`
        })
        .join(', ')
    }
    return `${keys.slice(0, 3).join(', ')} (+${keys.length - 3} more)`
  }

  /**
   * Calculate run duration in seconds
   */
  private calculateDurationSeconds(run: Run): number {
    const startTime = run.timestamps.started_at ?? run.timestamps.created_at
    const endTime = run.timestamps.completed_at ?? new Date().toISOString()
    return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
  }

  /**
   * Get the last phase from events
   */
  private getLastPhase(events: Event[]): Phase {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].phase) {
        return events[i].phase
      }
    }
    return 'pending'
  }

  /**
   * Extract a short title from goal
   */
  private getGoalTitle(goal: string): string {
    const firstLine = goal.split('\n')[0]
    if (firstLine.length <= 60) return firstLine
    return firstLine.slice(0, 57) + '...'
  }

  /**
   * Escape special characters for YAML string values
   */
  private escapeYamlString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
  }
}

/**
 * Factory function for creating TraceWriter instances
 */
export function createTraceWriter(vaultPath: string): TraceWriter {
  return new TraceWriter(vaultPath)
}
