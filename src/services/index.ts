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
