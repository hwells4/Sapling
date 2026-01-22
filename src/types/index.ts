// Domain types for Sapling OS

// Contract types
export {
  // Schemas
  RunContractSchema,
  SuccessCriterionSchema,
  DeliverableSpecSchema,
  ConstraintSchema,
  ToolPolicySchema,
  IntegrationScopeSchema,
  ApprovalRuleSchema,
  OutputDestinationSchema,
  // Enums
  EvidenceType,
  DeliverableType,
  ConstraintRuleType,
  ApprovalCondition,
  ApprovalTimeoutAction,
  // Types
  type RunContract,
  type SuccessCriterion,
  type DeliverableSpec,
  type Constraint,
  type ToolPolicy,
  type IntegrationScope,
  type ApprovalRule,
  type OutputDestination,
  // Helpers
  validateContract,
  isValidContract,
} from './contract'

// Event types
export {
  // Schemas
  EventSchema,
  RunStartedPayload,
  PhaseChangedPayload,
  ToolCalledPayload,
  ToolResultPayload,
  FileChangedPayload,
  ArtifactCreatedPayload,
  CheckpointRequestedPayload,
  CheckpointApprovedPayload,
  CheckpointRejectedPayload,
  CheckpointTimeoutPayload,
  DriftDetectedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  EventPayloadSchemas,
  // Enums
  Phase,
  Severity,
  EventType,
  // Types
  type Event,
  type EventPayload,
  type EventPayloadMap,
  type TypedEvent,
  type CreateEventInput,
  // Helpers
  createEvent,
  validateEvent,
  isValidEvent,
  validateEventPayload,
} from './event'

// Run types
export {
  // Schemas
  RunSchema,
  ExecutionEnvSchema,
  CostBreakdownSchema,
  ArtifactRefSchema,
  RunTimestampsSchema,
  // Enums
  RunState,
  UserAction,
  // Types
  type Run,
  type ExecutionEnv,
  type CostBreakdown,
  type ArtifactRef,
  type RunTimestamps,
  // Helpers
  isValidTransition,
  getValidTransitions,
  isValidAction,
  getValidActions,
  isTerminalState,
  validateRun,
  isValidRun,
  createCostBreakdown,
} from './run'

// Artifact types
export {
  // Schemas
  ArtifactManifestSchema,
  // Enums
  ArtifactType,
  PreviewType,
  ArtifactStatus,
  // Constants
  MIME_TYPES,
  // Types
  type ArtifactManifest,
  // Helpers
  getDefaultPreviewType,
  validateArtifactManifest,
  isValidArtifactManifest,
  createArtifactManifest,
} from './artifact'

// Template types
export {
  // Schemas
  AgentTemplateSchema,
  AgentTemplateRefSchema,
  TemplateCatalogEntrySchema,
  OutputMappingRuleSchema,
  SubAgentSpecSchema,
  SuccessCriteriaTemplateSchema,
  // Types
  type AgentTemplate,
  type AgentTemplateRef,
  type TemplateCatalogEntry,
  type OutputMappingRule,
  type SubAgentSpec,
  type SuccessCriteriaTemplate,
  // Helpers
  validateAgentTemplate,
  isValidAgentTemplate,
  compareVersions,
} from './template'
