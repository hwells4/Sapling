import { z } from 'zod'

// Evidence types for success criteria
export const EvidenceType = z.enum([
  'file_exists',
  'api_response',
  'test_passed',
  'manual_check',
])
export type EvidenceType = z.infer<typeof EvidenceType>

// Success criterion - measurable outcome for a run
export const SuccessCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  evidence_type: EvidenceType,
  evidence_spec: z.record(z.unknown()).optional(),
})
export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>

// Deliverable types
export const DeliverableType = z.enum([
  'markdown',
  'email_draft',
  'calendar_event',
  'pr_diff',
  'json_data',
])
export type DeliverableType = z.infer<typeof DeliverableType>

// Deliverable specification - what must be produced
export const DeliverableSpecSchema = z.object({
  id: z.string(),
  type: DeliverableType,
  destination: z.string(), // Vault path pattern with variables
  required: z.boolean(),
})
export type DeliverableSpec = z.infer<typeof DeliverableSpecSchema>

// Constraint rule types
export const ConstraintRuleType = z.enum([
  'tool_blocked',
  'path_blocked',
  'pattern_blocked',
  'custom',
])
export type ConstraintRuleType = z.infer<typeof ConstraintRuleType>

// Constraint - what must NOT happen
export const ConstraintSchema = z.object({
  id: z.string(),
  description: z.string(),
  rule_type: ConstraintRuleType,
  rule_spec: z.record(z.unknown()),
})
export type Constraint = z.infer<typeof ConstraintSchema>

// Tool policy - allowed/blocked tools
export const ToolPolicySchema = z.object({
  allowed: z.array(z.string()),
  blocked: z.array(z.string()),
})
export type ToolPolicy = z.infer<typeof ToolPolicySchema>

// Integration scope - external system access
export const IntegrationScopeSchema = z.object({
  system: z.string(), // e.g., 'github', 'gmail', 'calendar'
  scope: z.string(), // e.g., 'repo:owner/name', 'read', 'write'
  granted_at: z.string().datetime().optional(),
})
export type IntegrationScope = z.infer<typeof IntegrationScopeSchema>

// Approval conditions
export const ApprovalCondition = z.enum([
  'always',
  'first_time',
  'if_external',
  'never',
])
export type ApprovalCondition = z.infer<typeof ApprovalCondition>

// Approval timeout actions
export const ApprovalTimeoutAction = z.enum(['approve', 'reject'])
export type ApprovalTimeoutAction = z.infer<typeof ApprovalTimeoutAction>

// Approval rule - what requires human OK
export const ApprovalRuleSchema = z.object({
  action_type: z.string(), // e.g., 'send_email', 'create_pr', 'write_entity'
  condition: ApprovalCondition,
  timeout_seconds: z.number().int().positive(),
  auto_action_on_timeout: ApprovalTimeoutAction,
})
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>

// Output destination specification
export const OutputDestinationSchema = z.object({
  deliverable_id: z.string(),
  path_pattern: z.string(), // e.g., 'brain/outputs/{year}/{month}/{run_id}_{slug}.md'
})
export type OutputDestination = z.infer<typeof OutputDestinationSchema>

// The core RunContract schema
export const RunContractSchema = z.object({
  // Identity
  contract_version: z.literal('1.0'),
  template_id: z.string(),
  template_version: z.string(),

  // Goal
  goal: z.string(),
  success_criteria: z.array(SuccessCriterionSchema),

  // Deliverables
  deliverables: z.array(DeliverableSpecSchema),

  // Constraints
  constraints: z.array(ConstraintSchema),

  // Permissions
  tool_policy: ToolPolicySchema,
  integration_scopes: z.array(IntegrationScopeSchema),
  approval_rules: z.array(ApprovalRuleSchema),

  // Limits
  max_duration_seconds: z.number().int().positive(),
  max_cost_cents: z.number().int().nonnegative().optional(),

  // Context
  input_files: z.array(z.string()),
  output_destinations: z.array(OutputDestinationSchema),
})
export type RunContract = z.infer<typeof RunContractSchema>

// Validation helper
export function validateContract(data: unknown): RunContract {
  return RunContractSchema.parse(data)
}

// Type guard
export function isValidContract(data: unknown): data is RunContract {
  return RunContractSchema.safeParse(data).success
}
