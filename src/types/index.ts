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
  // Enums
  Phase,
  Severity,
  EventType,
  // Types
  type Event,
  type EventPayload,
  // Helpers
  createEvent,
  validateEvent,
  isValidEvent,
} from './event'
