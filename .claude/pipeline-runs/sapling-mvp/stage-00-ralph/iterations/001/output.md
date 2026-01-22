Completed **Sapling-chu: Implement credential storage service**.

**Summary:**
- Created `CredentialStore` interface in `src/services/credential-store.ts`
- Implemented AES-256-GCM encryption using WebCrypto (PBKDF2 key derivation, 100k iterations)
- Added audit logging for all credential operations (created, accessed, refreshed, revoked)
- Built `InMemoryCredentialStore` implementation for development
- Created factory function `createCredentialStore()` for environment-based store selection
- Backend-only design: tokens never exposed to frontend

**Files changed:**
- `src/services/credential-store.ts` (new)
- `src/services/index.ts` (new)
