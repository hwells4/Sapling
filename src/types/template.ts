import { z } from 'zod'
import {
  ToolPolicySchema,
  ApprovalRuleSchema,
  DeliverableSpecSchema,
  ConstraintSchema,
} from './contract'

// Semantic version format
const SemanticVersion = z.string().regex(
  /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/,
  'Invalid semantic version format (e.g., 1.0.0 or 1.0.0-beta.1)',
)

// Output mapping rule - where deliverables land in the vault
export const OutputMappingRuleSchema = z.object({
  deliverable_type: z.string(), // Matches DeliverableSpec.type
  path_pattern: z.string(), // e.g., 'brain/outputs/{year}/{month}/{run_id}_{slug}.md'
  frontmatter_template: z.record(z.string()).optional(), // Default frontmatter fields
})
export type OutputMappingRule = z.infer<typeof OutputMappingRuleSchema>

// Sub-agent definition for multi-agent templates
export const SubAgentSpecSchema = z.object({
  role: z.string(), // e.g., 'researcher', 'writer', 'reviewer'
  description: z.string(),
  tool_policy: ToolPolicySchema.optional(),
  handoff_trigger: z.string().optional(), // When to hand off to this sub-agent
})
export type SubAgentSpec = z.infer<typeof SubAgentSpecSchema>

// Default success criteria template
export const SuccessCriteriaTemplateSchema = z.object({
  id: z.string(),
  description: z.string(),
  evidence_type: z.enum(['file_exists', 'api_response', 'test_passed', 'manual_check']),
  required: z.boolean().default(true),
})
export type SuccessCriteriaTemplate = z.infer<typeof SuccessCriteriaTemplateSchema>

/**
 * AgentTemplate - a reusable "job role" definition.
 *
 * Templates are immutable once published. Calibration produces new versions
 * with a changelog. Runs store template_id + template_version for reproducibility.
 *
 * Examples: "Email Assistant", "GitHub Issue Triage", "Calendar Scheduler"
 */
export const AgentTemplateSchema = z.object({
  // Identity (immutable after publish)
  template_id: z.string(),
  version: SemanticVersion,

  // Display info
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(), // Icon name or emoji

  // Capabilities (what it can do)
  capabilities: z.array(z.string()),

  // Guardrails (what it cannot do)
  guardrails: z.array(z.string()),

  // Required inputs
  required_inputs: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['account', 'repo', 'folder', 'file', 'text']),
      description: z.string(),
    }),
  ),

  // Default contract schema components
  default_tool_policy: ToolPolicySchema,
  default_constraints: z.array(ConstraintSchema),
  default_approval_rules: z.array(ApprovalRuleSchema),

  // Deliverable specifications
  default_deliverables: z.array(DeliverableSpecSchema),
  output_mappings: z.array(OutputMappingRuleSchema),

  // Default success criteria
  default_success_criteria: z.array(SuccessCriteriaTemplateSchema),

  // Time and cost limits
  default_max_duration_seconds: z.number().int().positive(),
  estimated_cost_range: z
    .object({
      min_cents: z.number().int().nonnegative(),
      max_cents: z.number().int().nonnegative(),
    })
    .optional(),

  // Sub-agent topology (for multi-agent orchestration)
  sub_agents: z.array(SubAgentSpecSchema).optional(),

  // Metadata
  published_at: z.string().datetime(),
  author: z.string().optional(),
  changelog: z.string().optional(), // What changed from previous version
  previous_version: SemanticVersion.optional(),

  // Tags for categorization
  tags: z.array(z.string()).optional(),
})
export type AgentTemplate = z.infer<typeof AgentTemplateSchema>

// Minimal template reference for lists/cards
export const AgentTemplateRefSchema = z.object({
  template_id: z.string(),
  version: SemanticVersion,
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
})
export type AgentTemplateRef = z.infer<typeof AgentTemplateRefSchema>

// Template catalog entry (for browsing)
export const TemplateCatalogEntrySchema = AgentTemplateRefSchema.extend({
  capabilities: z.array(z.string()),
  estimated_cost_range: z
    .object({
      min_cents: z.number().int().nonnegative(),
      max_cents: z.number().int().nonnegative(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
})
export type TemplateCatalogEntry = z.infer<typeof TemplateCatalogEntrySchema>

// Validation helpers
export function validateAgentTemplate(data: unknown): AgentTemplate {
  return AgentTemplateSchema.parse(data)
}

export function isValidAgentTemplate(data: unknown): data is AgentTemplate {
  return AgentTemplateSchema.safeParse(data).success
}

// Version comparison helper
export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [version, prerelease] = v.split('-')
    const parts = version.split('.').map(Number)
    return { parts, prerelease }
  }

  const va = parseVersion(a)
  const vb = parseVersion(b)

  for (let i = 0; i < 3; i++) {
    if (va.parts[i] !== vb.parts[i]) {
      return va.parts[i] - vb.parts[i]
    }
  }

  // If one has prerelease and other doesn't, non-prerelease is higher
  if (va.prerelease && !vb.prerelease) return -1
  if (!va.prerelease && vb.prerelease) return 1

  // Both have prerelease or neither - compare lexically
  if (va.prerelease && vb.prerelease) {
    return va.prerelease.localeCompare(vb.prerelease)
  }

  return 0
}
