import { z } from 'zod'
import type {
  RunContract,
  ToolPolicy,
  Constraint,
  DeliverableSpec,
  SuccessCriterion,
  OutputDestination,
} from '../types/contract'
import { RunContractSchema, ConstraintRuleType } from '../types/contract'
import type { EventEmitter } from './events'
import type { DriftDetectedPayload } from '../types/event'

// Validation issue severity
export const ValidationSeverity = z.enum(['error', 'warning'])
export type ValidationSeverity = z.infer<typeof ValidationSeverity>

// Validation issue type
export const ValidationIssueType = z.enum([
  // Schema issues
  'schema_invalid',
  // Tool policy issues
  'tool_policy_conflict',
  'tool_not_granted',
  // Uniqueness issues
  'duplicate_id',
  // Reference issues
  'invalid_reference',
  // Constraint issues
  'constraint_violation',
  // Runtime issues
  'unauthorized_tool',
  'path_violation',
  'pattern_violation',
])
export type ValidationIssueType = z.infer<typeof ValidationIssueType>

// A single validation issue
export interface ValidationIssue {
  type: ValidationIssueType
  severity: ValidationSeverity
  message: string
  path?: string // JSON path to the issue location
  details?: Record<string, unknown>
}

// Validation result
export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

// Tool call for runtime validation
export interface ToolCall {
  tool_name: string
  tool_input: Record<string, unknown>
}

// Constraint check context
export interface ConstraintContext {
  tool_name?: string
  file_path?: string
  action?: string
  metadata?: Record<string, unknown>
}

// Drift detection result
export interface DriftResult {
  drifted: boolean
  drift_type?: DriftDetectedPayload['drift_type']
  details?: string
  tool_name?: string
  path?: string
}

/**
 * ContractValidator - validates contracts semantically beyond Zod schema.
 *
 * Responsibilities:
 * 1. Pre-run validation: schema, permissions, uniqueness, references
 * 2. Runtime validation: tool calls vs tool_policy
 * 3. Constraint checking: ensure constraints are not violated
 * 4. Drift detection: emit drift.detected events when agent violates contract
 */
export class ContractValidator {
  private eventEmitter: EventEmitter | null

  constructor(eventEmitter?: EventEmitter) {
    this.eventEmitter = eventEmitter ?? null
  }

  /**
   * Pre-run validation - validates contract before starting a run.
   * Checks schema, uniqueness, references, and tool policy conflicts.
   */
  validatePreRun(contract: unknown): ValidationResult {
    const issues: ValidationIssue[] = []

    // 1. Schema validation
    const schemaResult = RunContractSchema.safeParse(contract)
    if (!schemaResult.success) {
      for (const error of schemaResult.error.errors) {
        issues.push({
          type: 'schema_invalid',
          severity: 'error',
          message: error.message,
          path: error.path.join('.'),
          details: { code: error.code },
        })
      }
      return { valid: false, issues }
    }

    const validContract = schemaResult.data

    // 2. Tool policy conflict check
    const toolPolicyIssues = this.validateToolPolicy(validContract.tool_policy)
    issues.push(...toolPolicyIssues)

    // 3. Uniqueness validation for IDs
    const uniquenessIssues = this.validateUniqueness(validContract)
    issues.push(...uniquenessIssues)

    // 4. Reference validation (output_destinations -> deliverables)
    const referenceIssues = this.validateReferences(validContract)
    issues.push(...referenceIssues)

    const hasErrors = issues.some((i) => i.severity === 'error')
    return { valid: !hasErrors, issues }
  }

  /**
   * Validates tool policy for conflicts (same tool in allowed and blocked).
   */
  private validateToolPolicy(policy: ToolPolicy): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const allowedSet = new Set(policy.allowed)
    const conflicts = policy.blocked.filter((tool) => allowedSet.has(tool))

    for (const tool of conflicts) {
      issues.push({
        type: 'tool_policy_conflict',
        severity: 'error',
        message: `Tool "${tool}" appears in both allowed and blocked arrays`,
        path: 'tool_policy',
        details: { tool },
      })
    }

    return issues
  }

  /**
   * Validates uniqueness of IDs across arrays.
   */
  private validateUniqueness(contract: RunContract): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    // Check success_criteria IDs
    const criteriaIds = contract.success_criteria.map((c) => c.id)
    const duplicateCriteria = this.findDuplicates(criteriaIds)
    for (const id of duplicateCriteria) {
      issues.push({
        type: 'duplicate_id',
        severity: 'error',
        message: `Duplicate success_criteria ID: "${id}"`,
        path: 'success_criteria',
        details: { id, field: 'success_criteria' },
      })
    }

    // Check deliverables IDs
    const deliverableIds = contract.deliverables.map((d) => d.id)
    const duplicateDeliverables = this.findDuplicates(deliverableIds)
    for (const id of duplicateDeliverables) {
      issues.push({
        type: 'duplicate_id',
        severity: 'error',
        message: `Duplicate deliverable ID: "${id}"`,
        path: 'deliverables',
        details: { id, field: 'deliverables' },
      })
    }

    // Check constraints IDs
    const constraintIds = contract.constraints.map((c) => c.id)
    const duplicateConstraints = this.findDuplicates(constraintIds)
    for (const id of duplicateConstraints) {
      issues.push({
        type: 'duplicate_id',
        severity: 'error',
        message: `Duplicate constraint ID: "${id}"`,
        path: 'constraints',
        details: { id, field: 'constraints' },
      })
    }

    return issues
  }

  /**
   * Validates references between contract fields.
   */
  private validateReferences(contract: RunContract): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const deliverableIds = new Set(contract.deliverables.map((d) => d.id))

    // Check output_destinations reference valid deliverable_ids
    for (let i = 0; i < contract.output_destinations.length; i++) {
      const dest = contract.output_destinations[i]
      if (!deliverableIds.has(dest.deliverable_id)) {
        issues.push({
          type: 'invalid_reference',
          severity: 'error',
          message: `output_destination[${i}].deliverable_id "${dest.deliverable_id}" references non-existent deliverable`,
          path: `output_destinations[${i}].deliverable_id`,
          details: {
            deliverable_id: dest.deliverable_id,
            valid_ids: Array.from(deliverableIds),
          },
        })
      }
    }

    return issues
  }

  /**
   * Runtime validation - validates a tool call against the contract's tool_policy.
   */
  validateToolCall(contract: RunContract, toolCall: ToolCall): ValidationResult {
    const issues: ValidationIssue[] = []
    const { tool_policy } = contract
    const { tool_name } = toolCall

    // Check if tool is explicitly blocked
    if (tool_policy.blocked.includes(tool_name)) {
      issues.push({
        type: 'unauthorized_tool',
        severity: 'error',
        message: `Tool "${tool_name}" is blocked by tool_policy`,
        details: { tool_name, blocked: tool_policy.blocked },
      })
    }

    // If allowed list is non-empty, tool must be in it
    if (tool_policy.allowed.length > 0 && !tool_policy.allowed.includes(tool_name)) {
      issues.push({
        type: 'unauthorized_tool',
        severity: 'error',
        message: `Tool "${tool_name}" is not in allowed tools list`,
        details: { tool_name, allowed: tool_policy.allowed },
      })
    }

    const hasErrors = issues.some((i) => i.severity === 'error')
    return { valid: !hasErrors, issues }
  }

  /**
   * Validates an action against all constraints in the contract.
   */
  validateConstraints(
    contract: RunContract,
    context: ConstraintContext,
  ): ValidationResult {
    const issues: ValidationIssue[] = []

    for (const constraint of contract.constraints) {
      const violation = this.checkConstraint(constraint, context)
      if (violation) {
        issues.push(violation)
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error')
    return { valid: !hasErrors, issues }
  }

  /**
   * Checks a single constraint against the given context.
   */
  private checkConstraint(
    constraint: Constraint,
    context: ConstraintContext,
  ): ValidationIssue | null {
    const { rule_type, rule_spec, description } = constraint

    switch (rule_type) {
      case 'tool_blocked': {
        // rule_spec.tools: string[] - blocked tool names
        const blockedTools = (rule_spec.tools as string[]) ?? []
        if (context.tool_name && blockedTools.includes(context.tool_name)) {
          return {
            type: 'constraint_violation',
            severity: 'error',
            message: `Constraint violated: ${description}`,
            details: {
              constraint_id: constraint.id,
              tool_name: context.tool_name,
              blocked_tools: blockedTools,
            },
          }
        }
        break
      }

      case 'path_blocked': {
        // rule_spec.paths: string[] - blocked path patterns (glob-like)
        const blockedPaths = (rule_spec.paths as string[]) ?? []
        if (context.file_path) {
          for (const pattern of blockedPaths) {
            if (this.matchesPath(context.file_path, pattern)) {
              return {
                type: 'path_violation',
                severity: 'error',
                message: `Constraint violated: ${description}`,
                details: {
                  constraint_id: constraint.id,
                  file_path: context.file_path,
                  blocked_pattern: pattern,
                },
              }
            }
          }
        }
        break
      }

      case 'pattern_blocked': {
        // rule_spec.patterns: string[] - regex patterns to block
        const blockedPatterns = (rule_spec.patterns as string[]) ?? []
        const textToCheck =
          context.action ?? context.tool_name ?? context.file_path ?? ''
        for (const patternStr of blockedPatterns) {
          try {
            const regex = new RegExp(patternStr)
            if (regex.test(textToCheck)) {
              return {
                type: 'pattern_violation',
                severity: 'error',
                message: `Constraint violated: ${description}`,
                details: {
                  constraint_id: constraint.id,
                  matched_text: textToCheck,
                  blocked_pattern: patternStr,
                },
              }
            }
          } catch {
            // Invalid regex, skip
          }
        }
        break
      }

      case 'custom': {
        // Custom constraints require external validation logic
        // For now, just check if a custom validator is provided in rule_spec
        const validatorName = rule_spec.validator as string | undefined
        if (validatorName) {
          // Custom validators would be registered externally
          // This is a placeholder for future extension
        }
        break
      }
    }

    return null
  }

  /**
   * Simple path matching (supports * and ** wildcards).
   */
  private matchesPath(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<DOUBLE_STAR>>>/g, '.*')
      .replace(/\?/g, '.')

    try {
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(path)
    } catch {
      return false
    }
  }

  /**
   * Detects drift - when agent actions deviate from the contract.
   * Optionally emits drift.detected event if eventEmitter is configured.
   */
  detectDrift(
    runId: string,
    contract: RunContract,
    context: ConstraintContext,
    phase: 'planning' | 'executing' | 'verifying',
  ): DriftResult {
    // Check tool authorization
    if (context.tool_name) {
      const toolResult = this.validateToolCall(contract, {
        tool_name: context.tool_name,
        tool_input: context.metadata ?? {},
      })
      if (!toolResult.valid) {
        const drift: DriftResult = {
          drifted: true,
          drift_type: 'unauthorized_tool',
          details: `Tool "${context.tool_name}" is not authorized by contract`,
          tool_name: context.tool_name,
        }
        this.emitDriftEvent(runId, 0, phase, drift)
        return drift
      }
    }

    // Check constraint violations
    const constraintResult = this.validateConstraints(contract, context)
    if (!constraintResult.valid) {
      const firstIssue = constraintResult.issues[0]
      let driftType: DriftDetectedPayload['drift_type'] = 'constraint_breach'

      if (firstIssue.type === 'path_violation') {
        driftType = 'path_violation'
      }

      const drift: DriftResult = {
        drifted: true,
        drift_type: driftType,
        details: firstIssue.message,
        tool_name: context.tool_name,
        path: context.file_path,
      }
      this.emitDriftEvent(runId, 0, phase, drift)
      return drift
    }

    return { drifted: false }
  }

  /**
   * Emits a drift.detected event via the configured EventEmitter.
   */
  private emitDriftEvent(
    runId: string,
    _seq: number, // seq is managed by the emitter
    phase: 'planning' | 'executing' | 'verifying',
    drift: DriftResult,
  ): void {
    if (!this.eventEmitter || !drift.drifted || !drift.drift_type) {
      return
    }

    this.eventEmitter.emit(
      runId,
      'drift.detected',
      {
        drift_type: drift.drift_type,
        details: drift.details ?? 'Contract drift detected',
        tool_name: drift.tool_name,
        path: drift.path,
      },
      phase,
      'error',
    )
  }

  /**
   * Finds duplicate values in an array.
   */
  private findDuplicates(arr: string[]): string[] {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    for (const item of arr) {
      if (seen.has(item)) {
        duplicates.add(item)
      }
      seen.add(item)
    }

    return Array.from(duplicates)
  }
}

// Factory function
export function createContractValidator(
  eventEmitter?: EventEmitter,
): ContractValidator {
  return new ContractValidator(eventEmitter)
}
