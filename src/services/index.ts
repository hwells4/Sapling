// Services for Sapling OS

export {
  // Schemas
  IntegrationType,
  OAuthTokenSchema,
  CredentialMetadataSchema,
  CredentialAuditAction,
  CredentialAuditEntrySchema,
  // Types
  type OAuthToken,
  type CredentialMetadata,
  type CredentialAuditEntry,
  type StoreResult,
  type CredentialStore,
  // Encryption utilities
  encryptToken,
  decryptToken,
  // Implementations
  InMemoryCredentialStore,
  // Factory
  createCredentialStore,
} from './credential-store'

export {
  // Types
  type EventSubscriber,
  type SubscriptionOptions,
  type Subscription,
  type EmitResult,
  type EventEmitter,
  // Implementations
  InMemoryEventEmitter,
  // Factory
  createEventEmitter,
} from './events'

export {
  // Types
  type EventStoreResult,
  type EventCursor,
  type EventQueryOptions,
  type EventPage,
  type EventStats,
  type EventStore,
  // Implementations
  InMemoryEventStore,
  // Factory
  createEventStore,
} from './event-store'

export {
  // Types
  type ConnectionType,
  type ConnectionState,
  type StreamConnection,
  type StreamOptions,
  type SSEMessage,
  type WebSocketMessageType,
  type WebSocketMessage,
  type SSESender,
  type WebSocketSender,
  type StreamHandle,
  type EventStreamService,
  // Implementations
  InMemoryEventStreamService,
  // Factory
  createEventStreamService,
  // Utilities
  formatSSEMessage,
  parseStreamOptions,
} from './event-stream'

export {
  // Types
  type StateMachineErrorType,
  type TransitionResult,
  type TransitionInput,
  type ActionInput,
  type DriftContext,
  // Error class
  StateMachineError,
  // Implementation
  RunStateMachine,
  // Factory
  createRunStateMachine,
} from './run-state-machine'

export {
  // Schemas
  ApprovalStatus,
  ApprovalSource,
  RejectionReason,
  TimeoutAction,
  // Types
  type PendingApproval,
  type ApprovalAuditEntry,
  type ApprovalResult,
  type RequestApprovalOptions,
  type BulkApprovalOptions,
  type ApprovalService,
  // Implementations
  InMemoryApprovalService,
  // Factory
  createApprovalService,
} from './approvals'

export {
  // Schemas
  ValidationSeverity,
  ValidationIssueType,
  // Types
  type ValidationIssue,
  type ValidationResult,
  type ToolCall,
  type ConstraintContext,
  type DriftResult,
  // Implementation
  ContractValidator,
  // Factory
  createContractValidator,
} from './contract-validator'

export {
  // Schemas
  ErrorCategory,
  ErrorDetailsSchema,
  PartialResultsSchema,
  // Types
  type ErrorDetails,
  type PartialResults,
  type HandleErrorResult,
  type ErrorInput,
  type PartialResultsInput,
  // Implementation
  ErrorHandler,
  // Factory
  createErrorHandler,
} from './error-handler'

export {
  // Schemas
  CostType,
  CostEntrySchema,
  BudgetConfigSchema,
  // Types
  type CostEntry,
  type BudgetConfig,
  type BudgetStatus,
  type CostEstimate,
  type AddCostResult,
  // Implementation
  CostTracker,
  // Factory
  createCostTracker,
} from './cost-tracker'

export {
  // Types
  type WriteArtifactOptions,
  type WriteResult,
  // Implementation
  VaultWriter,
  // Factory
  createVaultWriter,
} from './vault-writer'

export {
  // Types
  type TraceEntryType,
  type TraceEntry,
  type ContractEntry,
  type PhaseStartEntry,
  type PhaseEndEntry,
  type DecisionEntry,
  type ToolCallEntry,
  type ToolResultEntry,
  type ErrorEntry,
  type RecoveryEntry,
  type CalibrationSeedEntry,
  type RunCompleteEntry,
  type RunFailedEntry,
  type PhaseSummary,
  type WriteTraceOptions,
  type WriteTraceResult,
  // Implementation
  TraceWriter,
  // Factory
  createTraceWriter,
} from './trace-writer'

export {
  // Schemas
  ApprovalAuditAction,
  ApprovalAuditSource,
  ApprovalAuditRecordSchema,
  // Types
  type RunDBResult,
  type RunFilter,
  type RunPagination,
  type RunListResult,
  type ApprovalAuditRecord,
  type CreateRunInput,
  type UpdateRunStateInput,
  type RunDBTransaction,
  type RunDB,
  // Implementations
  InMemoryRunDB,
  // Factory
  createRunDB,
} from './run-db'

export {
  // Types
  type SandboxOutputType,
  type SandboxOutput,
  type ExtractedArtifact,
  type SandboxExecutionResult,
  type SandboxCheckpoint,
  type CreateSandboxOptions,
  type RunCodeOptions,
  type SandboxState,
  // Implementation
  SandboxAdapter,
  // Factory
  createSandboxAdapter,
} from './sandbox-adapter'

export {
  // Types
  type OrchestratorState,
  type StartRunOptions,
  type UserActionOptions,
  type OrchestratorResult,
  type OrchestratorEvents,
  type OrchestratorDependencies,
  // Implementation
  RunOrchestrator,
  // Factory
  createRunOrchestrator,
} from './run-orchestrator'
