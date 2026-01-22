import { z } from 'zod'

// Supported integration types
export const IntegrationType = z.enum([
  'github',
  'gmail',
  'calendar',
  'slack',
])
export type IntegrationType = z.infer<typeof IntegrationType>

// OAuth token structure
export const OAuthTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().default('Bearer'),
  expires_at: z.string().datetime(), // ISO 8601
  scope: z.string(),
})
export type OAuthToken = z.infer<typeof OAuthTokenSchema>

// Stored credential metadata (never includes raw tokens)
export const CredentialMetadataSchema = z.object({
  id: z.string(),
  integration: IntegrationType,
  account_identifier: z.string(), // e.g., email address, username
  scopes_granted: z.array(z.string()),
  created_at: z.string().datetime(),
  last_refreshed_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
  revoked: z.boolean().default(false),
  revoked_at: z.string().datetime().optional(),
})
export type CredentialMetadata = z.infer<typeof CredentialMetadataSchema>

// Audit event types
export const CredentialAuditAction = z.enum([
  'created',
  'refreshed',
  'accessed',
  'revoked',
  'scope_changed',
  'refresh_failed',
])
export type CredentialAuditAction = z.infer<typeof CredentialAuditAction>

// Audit log entry
export const CredentialAuditEntrySchema = z.object({
  id: z.string(),
  credential_id: z.string(),
  action: CredentialAuditAction,
  timestamp: z.string().datetime(),
  run_id: z.string().optional(), // Which run accessed/used the credential
  details: z.record(z.unknown()).optional(),
})
export type CredentialAuditEntry = z.infer<typeof CredentialAuditEntrySchema>

// Result types for store operations
export type StoreResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// Interface for credential storage operations
// Backend-only: never expose to frontend
export interface CredentialStore {
  // Store a new credential (encrypts before storage)
  store(
    integration: IntegrationType,
    accountIdentifier: string,
    token: OAuthToken
  ): Promise<StoreResult<CredentialMetadata>>

  // Get short-lived access token for a run (injects at tool call time)
  getAccessToken(
    credentialId: string,
    runId: string
  ): Promise<StoreResult<{ token: string; expires_at: string }>>

  // List credentials for an integration (metadata only, no tokens)
  list(integration?: IntegrationType): Promise<StoreResult<CredentialMetadata[]>>

  // Get credential metadata by ID
  get(credentialId: string): Promise<StoreResult<CredentialMetadata>>

  // Revoke a credential
  revoke(credentialId: string): Promise<StoreResult<void>>

  // Refresh token rotation (called automatically when token nears expiry)
  refresh(credentialId: string): Promise<StoreResult<CredentialMetadata>>

  // Get audit log for a credential
  getAuditLog(credentialId: string): Promise<StoreResult<CredentialAuditEntry[]>>
}

// Encryption utilities using WebCrypto
// These run server-side only

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptToken(
  token: OAuthToken,
  encryptionSecret: string
): Promise<{ encrypted: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(encryptionSecret, salt)

  const encoder = new TextEncoder()
  const plaintext = encoder.encode(JSON.stringify(token))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )

  return {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  }
}

export async function decryptToken(
  encrypted: string,
  salt: string,
  iv: string,
  encryptionSecret: string
): Promise<OAuthToken> {
  const saltBytes = Buffer.from(salt, 'base64')
  const ivBytes = Buffer.from(iv, 'base64')
  const ciphertext = Buffer.from(encrypted, 'base64')

  const key = await deriveKey(encryptionSecret, new Uint8Array(saltBytes))

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
    key,
    ciphertext
  )

  const decoder = new TextDecoder()
  const json = decoder.decode(plaintext)
  return OAuthTokenSchema.parse(JSON.parse(json))
}

// Generate a unique credential ID
function generateCredentialId(): string {
  return `cred_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
}

// Generate a unique audit entry ID
function generateAuditId(): string {
  return `audit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
}

// In-memory implementation for development/testing
// Production should use a database with encrypted columns
export class InMemoryCredentialStore implements CredentialStore {
  private credentials = new Map<
    string,
    {
      metadata: CredentialMetadata
      encrypted: string
      salt: string
      iv: string
    }
  >()
  private auditLog = new Map<string, CredentialAuditEntry[]>()
  private encryptionSecret: string

  constructor(encryptionSecret: string) {
    this.encryptionSecret = encryptionSecret
  }

  private logAudit(
    credentialId: string,
    action: CredentialAuditAction,
    runId?: string,
    details?: Record<string, unknown>
  ): void {
    const entry: CredentialAuditEntry = {
      id: generateAuditId(),
      credential_id: credentialId,
      action,
      timestamp: new Date().toISOString(),
      run_id: runId,
      details,
    }

    const log = this.auditLog.get(credentialId) ?? []
    log.push(entry)
    this.auditLog.set(credentialId, log)
  }

  async store(
    integration: IntegrationType,
    accountIdentifier: string,
    token: OAuthToken
  ): Promise<StoreResult<CredentialMetadata>> {
    try {
      const id = generateCredentialId()
      const now = new Date().toISOString()
      const scopes = token.scope.split(' ').filter(Boolean)

      const { encrypted, salt, iv } = await encryptToken(
        token,
        this.encryptionSecret
      )

      const metadata: CredentialMetadata = {
        id,
        integration,
        account_identifier: accountIdentifier,
        scopes_granted: scopes,
        created_at: now,
        expires_at: token.expires_at,
        revoked: false,
      }

      this.credentials.set(id, { metadata, encrypted, salt, iv })
      this.logAudit(id, 'created', undefined, { scopes })

      return { success: true, data: metadata }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getAccessToken(
    credentialId: string,
    runId: string
  ): Promise<StoreResult<{ token: string; expires_at: string }>> {
    try {
      const stored = this.credentials.get(credentialId)
      if (!stored) {
        return { success: false, error: 'Credential not found' }
      }

      if (stored.metadata.revoked) {
        return { success: false, error: 'Credential has been revoked' }
      }

      const token = await decryptToken(
        stored.encrypted,
        stored.salt,
        stored.iv,
        this.encryptionSecret
      )

      // Check if token is expired
      const expiresAt = new Date(token.expires_at)
      if (expiresAt <= new Date()) {
        // Token expired - attempt refresh if refresh_token exists
        if (token.refresh_token) {
          const refreshResult = await this.refresh(credentialId)
          if (!refreshResult.success) {
            return { success: false, error: 'Token expired and refresh failed' }
          }
          // Retry getting token after refresh
          return this.getAccessToken(credentialId, runId)
        }
        return { success: false, error: 'Token expired and no refresh token available' }
      }

      this.logAudit(credentialId, 'accessed', runId)

      return {
        success: true,
        data: {
          token: token.access_token,
          expires_at: token.expires_at,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async list(
    integration?: IntegrationType
  ): Promise<StoreResult<CredentialMetadata[]>> {
    const credentials = Array.from(this.credentials.values())
      .map((c) => c.metadata)
      .filter((m) => !integration || m.integration === integration)
      .filter((m) => !m.revoked)

    return { success: true, data: credentials }
  }

  async get(credentialId: string): Promise<StoreResult<CredentialMetadata>> {
    const stored = this.credentials.get(credentialId)
    if (!stored) {
      return { success: false, error: 'Credential not found' }
    }
    return { success: true, data: stored.metadata }
  }

  async revoke(credentialId: string): Promise<StoreResult<void>> {
    const stored = this.credentials.get(credentialId)
    if (!stored) {
      return { success: false, error: 'Credential not found' }
    }

    const now = new Date().toISOString()
    stored.metadata.revoked = true
    stored.metadata.revoked_at = now

    this.logAudit(credentialId, 'revoked')

    return { success: true, data: undefined }
  }

  async refresh(credentialId: string): Promise<StoreResult<CredentialMetadata>> {
    const stored = this.credentials.get(credentialId)
    if (!stored) {
      return { success: false, error: 'Credential not found' }
    }

    if (stored.metadata.revoked) {
      return { success: false, error: 'Cannot refresh revoked credential' }
    }

    try {
      const token = await decryptToken(
        stored.encrypted,
        stored.salt,
        stored.iv,
        this.encryptionSecret
      )

      if (!token.refresh_token) {
        this.logAudit(credentialId, 'refresh_failed', undefined, {
          reason: 'No refresh token',
        })
        return { success: false, error: 'No refresh token available' }
      }

      // In a real implementation, this would call the OAuth provider's token endpoint
      // For now, we simulate a refresh by extending the expiry
      const newExpiresAt = new Date(
        Date.now() + 3600 * 1000
      ).toISOString() // +1 hour

      const newToken: OAuthToken = {
        ...token,
        expires_at: newExpiresAt,
        // In real OAuth, refresh_token might also rotate
      }

      const { encrypted, salt, iv } = await encryptToken(
        newToken,
        this.encryptionSecret
      )

      const now = new Date().toISOString()
      stored.metadata.last_refreshed_at = now
      stored.metadata.expires_at = newExpiresAt
      stored.encrypted = encrypted
      stored.salt = salt
      stored.iv = iv

      this.logAudit(credentialId, 'refreshed')

      return { success: true, data: stored.metadata }
    } catch (error) {
      this.logAudit(credentialId, 'refresh_failed', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getAuditLog(
    credentialId: string
  ): Promise<StoreResult<CredentialAuditEntry[]>> {
    const log = this.auditLog.get(credentialId) ?? []
    return { success: true, data: log }
  }
}

// Factory function to create the appropriate store based on environment
export function createCredentialStore(
  encryptionSecret: string
): CredentialStore {
  // In production, this would check for Tauri environment and use
  // tauri-plugin-keyring for OS keychain, or a database adapter
  // For now, return the in-memory implementation
  return new InMemoryCredentialStore(encryptionSecret)
}
