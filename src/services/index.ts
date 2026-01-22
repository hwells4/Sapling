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
