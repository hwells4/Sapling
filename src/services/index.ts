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
