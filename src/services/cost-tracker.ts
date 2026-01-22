import { z } from 'zod'
import { type CostBreakdown, createCostBreakdown } from '../types/run'
import { type EventEmitter } from './events'

/**
 * Cost types for tracking different spending categories
 */
export const CostType = z.enum([
  'e2b_compute',      // E2B sandbox compute time
  'claude_api',       // Claude API usage
  'external_api',     // External API calls (e.g., GitHub, Linear)
])
export type CostType = z.infer<typeof CostType>

/**
 * A single cost entry for tracking
 */
export const CostEntrySchema = z.object({
  entry_id: z.string(),
  run_id: z.string(),
  cost_type: CostType,
  /** Cost in cents (1/100 of a dollar) */
  amount_cents: z.number().int().nonnegative(),
  /** Description of what incurred the cost */
  description: z.string(),
  /** Timestamp when cost was incurred */
  incurred_at: z.string().datetime(),
  /** Additional metadata (e.g., model name, tool name) */
  metadata: z.record(z.unknown()).optional(),
})
export type CostEntry = z.infer<typeof CostEntrySchema>

/**
 * Budget configuration for a workspace
 */
export const BudgetConfigSchema = z.object({
  /** Maximum total spend per run in cents */
  max_per_run_cents: z.number().int().positive().optional(),
  /** Maximum total spend per day in cents */
  max_per_day_cents: z.number().int().positive().optional(),
  /** Maximum total spend per month in cents */
  max_per_month_cents: z.number().int().positive().optional(),
  /** Warning threshold as percentage of limit (0-100) */
  warning_threshold_percent: z.number().min(0).max(100).default(80),
})
export type BudgetConfig = z.infer<typeof BudgetConfigSchema>

/**
 * Budget status for a workspace
 */
export interface BudgetStatus {
  /** Current run spend in cents */
  current_run_cents: number
  /** Current day spend in cents */
  current_day_cents: number
  /** Current month spend in cents */
  current_month_cents: number
  /** Whether any limit is exceeded */
  limit_exceeded: boolean
  /** Which limit was exceeded (if any) */
  exceeded_limit?: 'run' | 'day' | 'month'
  /** Whether we're at warning threshold */
  at_warning: boolean
  /** Which limit is at warning (if any) */
  warning_limit?: 'run' | 'day' | 'month'
}

/**
 * Pre-run cost estimate
 */
export interface CostEstimate {
  /** Estimated compute cost in cents */
  compute_cents: number
  /** Estimated API cost in cents */
  api_cents: number
  /** Total estimated cost in cents */
  total_cents: number
  /** Low estimate (80% confidence lower bound) */
  low_cents: number
  /** High estimate (80% confidence upper bound) */
  high_cents: number
  /** Estimation factors used */
  factors: {
    estimated_tokens: number
    estimated_compute_minutes: number
    tool_calls_estimated: number
  }
}

/**
 * Standard pricing rates (in cents)
 */
interface PricingRates {
  /** Claude API cost per 1K input tokens */
  claude_input_per_1k: number
  /** Claude API cost per 1K output tokens */
  claude_output_per_1k: number
  /** E2B compute cost per minute */
  e2b_per_minute: number
  /** External API average cost per call */
  external_api_per_call: number
}

const DEFAULT_PRICING: PricingRates = {
  claude_input_per_1k: 3,      // $0.03 per 1K input tokens
  claude_output_per_1k: 15,    // $0.15 per 1K output tokens
  e2b_per_minute: 1,           // $0.01 per minute
  external_api_per_call: 0,    // Most are free, some have costs
}

/**
 * Result of adding a cost entry
 */
export interface AddCostResult {
  success: boolean
  entry?: CostEntry
  /** If budget exceeded, this explains why */
  budget_exceeded?: {
    limit: 'run' | 'day' | 'month'
    current_cents: number
    limit_cents: number
  }
}

/**
 * CostTracker - tracks and enforces cost limits for runs
 *
 * This service:
 * - Tracks E2B, Claude, and external API costs
 * - Enforces workspace-level budget limits
 * - Provides pre-run cost estimates
 * - Aggregates costs into CostBreakdown for runs
 */
export class CostTracker {
  /** Cost entries by run_id */
  private entriesByRun: Map<string, CostEntry[]> = new Map()

  /** Budget configs by workspace_id */
  private budgets: Map<string, BudgetConfig> = new Map()

  /** Daily totals by workspace_id:YYYY-MM-DD */
  private dailyTotals: Map<string, number> = new Map()

  /** Monthly totals by workspace_id:YYYY-MM */
  private monthlyTotals: Map<string, number> = new Map()

  constructor(
    private readonly eventEmitter?: EventEmitter,
    private readonly pricing: PricingRates = DEFAULT_PRICING,
  ) {}

  /**
   * Add a cost entry for a run
   *
   * Returns failure if budget would be exceeded
   */
  addCost(
    runId: string,
    workspaceId: string,
    costType: CostType,
    amountCents: number,
    description: string,
    metadata?: Record<string, unknown>,
  ): AddCostResult {
    // Check budget before adding
    const budgetStatus = this.checkBudget(runId, workspaceId, amountCents)
    if (budgetStatus.limit_exceeded && budgetStatus.exceeded_limit) {
      const budget = this.budgets.get(workspaceId)
      const limitCents = budgetStatus.exceeded_limit === 'run'
        ? budget?.max_per_run_cents ?? 0
        : budgetStatus.exceeded_limit === 'day'
          ? budget?.max_per_day_cents ?? 0
          : budget?.max_per_month_cents ?? 0

      return {
        success: false,
        budget_exceeded: {
          limit: budgetStatus.exceeded_limit,
          current_cents: this.getCurrentSpend(runId, workspaceId, budgetStatus.exceeded_limit),
          limit_cents: limitCents,
        },
      }
    }

    const entry: CostEntry = {
      entry_id: crypto.randomUUID(),
      run_id: runId,
      cost_type: costType,
      amount_cents: amountCents,
      description,
      incurred_at: new Date().toISOString(),
      metadata,
    }

    // Store entry
    if (!this.entriesByRun.has(runId)) {
      this.entriesByRun.set(runId, [])
    }
    this.entriesByRun.get(runId)!.push(entry)

    // Update daily and monthly totals
    this.updateTotals(workspaceId, amountCents)

    return { success: true, entry }
  }

  /**
   * Track E2B compute usage
   */
  trackE2BUsage(runId: string, workspaceId: string, durationMinutes: number): AddCostResult {
    const amountCents = Math.ceil(durationMinutes * this.pricing.e2b_per_minute)
    return this.addCost(
      runId,
      workspaceId,
      'e2b_compute',
      amountCents,
      `E2B compute: ${durationMinutes.toFixed(2)} minutes`,
      { duration_minutes: durationMinutes },
    )
  }

  /**
   * Track Claude API usage
   */
  trackClaudeUsage(
    runId: string,
    workspaceId: string,
    inputTokens: number,
    outputTokens: number,
    model?: string,
  ): AddCostResult {
    const inputCost = Math.ceil((inputTokens / 1000) * this.pricing.claude_input_per_1k)
    const outputCost = Math.ceil((outputTokens / 1000) * this.pricing.claude_output_per_1k)
    const amountCents = inputCost + outputCost

    return this.addCost(
      runId,
      workspaceId,
      'claude_api',
      amountCents,
      `Claude API: ${inputTokens} input, ${outputTokens} output tokens`,
      { input_tokens: inputTokens, output_tokens: outputTokens, model },
    )
  }

  /**
   * Track external API usage
   */
  trackExternalAPIUsage(
    runId: string,
    workspaceId: string,
    apiName: string,
    amountCents: number,
  ): AddCostResult {
    return this.addCost(
      runId,
      workspaceId,
      'external_api',
      amountCents,
      `External API: ${apiName}`,
      { api_name: apiName },
    )
  }

  /**
   * Get current cost breakdown for a run
   */
  getCostBreakdown(runId: string): CostBreakdown {
    const entries = this.entriesByRun.get(runId) ?? []

    let computeCents = 0
    let apiCents = 0

    for (const entry of entries) {
      if (entry.cost_type === 'e2b_compute') {
        computeCents += entry.amount_cents
      } else {
        // Claude and external APIs are api costs
        apiCents += entry.amount_cents
      }
    }

    return createCostBreakdown(computeCents, apiCents)
  }

  /**
   * Get all cost entries for a run
   */
  getEntries(runId: string): CostEntry[] {
    return this.entriesByRun.get(runId) ?? []
  }

  /**
   * Set budget configuration for a workspace
   */
  setBudget(workspaceId: string, config: BudgetConfig): void {
    this.budgets.set(workspaceId, config)
  }

  /**
   * Get budget configuration for a workspace
   */
  getBudget(workspaceId: string): BudgetConfig | undefined {
    return this.budgets.get(workspaceId)
  }

  /**
   * Check budget status for a workspace (optionally with additional spend)
   */
  checkBudget(runId: string, workspaceId: string, additionalCents = 0): BudgetStatus {
    const budget = this.budgets.get(workspaceId)
    const entries = this.entriesByRun.get(runId) ?? []

    const runTotal = entries.reduce((sum, e) => sum + e.amount_cents, 0) + additionalCents
    const dayKey = this.getDayKey(workspaceId)
    const monthKey = this.getMonthKey(workspaceId)
    const dayTotal = (this.dailyTotals.get(dayKey) ?? 0) + additionalCents
    const monthTotal = (this.monthlyTotals.get(monthKey) ?? 0) + additionalCents

    let limitExceeded = false
    let exceededLimit: 'run' | 'day' | 'month' | undefined
    let atWarning = false
    let warningLimit: 'run' | 'day' | 'month' | undefined

    if (budget) {
      // Check run limit
      if (budget.max_per_run_cents && runTotal > budget.max_per_run_cents) {
        limitExceeded = true
        exceededLimit = 'run'
      } else if (budget.max_per_run_cents && runTotal >= budget.max_per_run_cents * (budget.warning_threshold_percent / 100)) {
        atWarning = true
        warningLimit = 'run'
      }

      // Check day limit
      if (budget.max_per_day_cents && dayTotal > budget.max_per_day_cents) {
        limitExceeded = true
        exceededLimit = 'day'
      } else if (budget.max_per_day_cents && dayTotal >= budget.max_per_day_cents * (budget.warning_threshold_percent / 100)) {
        atWarning = true
        warningLimit = warningLimit ?? 'day'
      }

      // Check month limit
      if (budget.max_per_month_cents && monthTotal > budget.max_per_month_cents) {
        limitExceeded = true
        exceededLimit = 'month'
      } else if (budget.max_per_month_cents && monthTotal >= budget.max_per_month_cents * (budget.warning_threshold_percent / 100)) {
        atWarning = true
        warningLimit = warningLimit ?? 'month'
      }
    }

    return {
      current_run_cents: runTotal,
      current_day_cents: dayTotal,
      current_month_cents: monthTotal,
      limit_exceeded: limitExceeded,
      exceeded_limit: exceededLimit,
      at_warning: atWarning,
      warning_limit: warningLimit,
    }
  }

  /**
   * Estimate cost for a run before execution
   *
   * Based on:
   * - Expected tokens from goal complexity
   * - Estimated compute time from template
   * - Expected tool calls
   */
  estimateCost(params: {
    goalTokens: number
    expectedOutputTokens?: number
    estimatedMinutes: number
    expectedToolCalls: number
  }): CostEstimate {
    const {
      goalTokens,
      expectedOutputTokens = goalTokens * 3, // Default: 3x input for output
      estimatedMinutes,
      expectedToolCalls,
    } = params

    // Calculate base costs
    const inputCost = Math.ceil((goalTokens / 1000) * this.pricing.claude_input_per_1k)
    const outputCost = Math.ceil((expectedOutputTokens / 1000) * this.pricing.claude_output_per_1k)
    const computeCost = Math.ceil(estimatedMinutes * this.pricing.e2b_per_minute)
    const externalCost = Math.ceil(expectedToolCalls * this.pricing.external_api_per_call)

    const apiCents = inputCost + outputCost + externalCost
    const totalCents = apiCents + computeCost

    // Add variance for low/high estimates (±30%)
    const variance = 0.3
    const lowCents = Math.floor(totalCents * (1 - variance))
    const highCents = Math.ceil(totalCents * (1 + variance))

    return {
      compute_cents: computeCost,
      api_cents: apiCents,
      total_cents: totalCents,
      low_cents: lowCents,
      high_cents: highCents,
      factors: {
        estimated_tokens: goalTokens + expectedOutputTokens,
        estimated_compute_minutes: estimatedMinutes,
        tool_calls_estimated: expectedToolCalls,
      },
    }
  }

  /**
   * Clear cost data for a run (on run cleanup)
   */
  clearRun(runId: string): void {
    this.entriesByRun.delete(runId)
  }

  /**
   * Get current spend for a specific period
   */
  private getCurrentSpend(runId: string, workspaceId: string, period: 'run' | 'day' | 'month'): number {
    switch (period) {
      case 'run': {
        const entries = this.entriesByRun.get(runId) ?? []
        return entries.reduce((sum, e) => sum + e.amount_cents, 0)
      }
      case 'day':
        return this.dailyTotals.get(this.getDayKey(workspaceId)) ?? 0
      case 'month':
        return this.monthlyTotals.get(this.getMonthKey(workspaceId)) ?? 0
    }
  }

  /**
   * Update daily and monthly totals
   */
  private updateTotals(workspaceId: string, amountCents: number): void {
    const dayKey = this.getDayKey(workspaceId)
    const monthKey = this.getMonthKey(workspaceId)

    this.dailyTotals.set(dayKey, (this.dailyTotals.get(dayKey) ?? 0) + amountCents)
    this.monthlyTotals.set(monthKey, (this.monthlyTotals.get(monthKey) ?? 0) + amountCents)
  }

  /**
   * Get the day key for a workspace
   */
  private getDayKey(workspaceId: string): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
    return `${workspaceId}:${dateStr}`
  }

  /**
   * Get the month key for a workspace
   */
  private getMonthKey(workspaceId: string): string {
    const now = new Date()
    const monthStr = now.toISOString().slice(0, 7) // YYYY-MM
    return `${workspaceId}:${monthStr}`
  }
}

/**
 * Factory function for creating CostTracker instances
 */
export function createCostTracker(
  eventEmitter?: EventEmitter,
  customPricing?: Partial<PricingRates>,
): CostTracker {
  const pricing = customPricing
    ? { ...DEFAULT_PRICING, ...customPricing }
    : DEFAULT_PRICING

  return new CostTracker(eventEmitter, pricing)
}
