# Progress: sapling-mvp

Verify: (none)

## Codebase Patterns
- **Zod schemas**: Use `z.enum()` for union types, `z.object()` for interfaces. Export both schema and inferred type.
- **Type exports**: Follow pattern in `src/types/index.ts` - export schemas, enums, types, and helper functions separately.
- **Services pattern**: Create service interfaces with `StoreResult<T>` return types for operations. Place in `src/services/`.
- **WebCrypto usage**: Cast `Uint8Array` to `BufferSource` for TypeScript compatibility with WebCrypto APIs.
- **Factory functions**: Use factory functions (e.g., `createCredentialStore`) for environment-based implementation selection.

---

## 2026-01-22 - Sapling-chu: Implement credential storage service
- Created `CredentialStore` interface with store/get/list/revoke/refresh operations
- Implemented AES-256-GCM encryption using WebCrypto (PBKDF2 key derivation, 100k iterations)
- Added `InMemoryCredentialStore` implementation for development
- Built audit logging system tracking credential access, refresh, and revocation
- Files: `src/services/credential-store.ts`, `src/services/index.ts`
- **Learnings**: WebCrypto's `Uint8Array` needs explicit `BufferSource` cast for TypeScript. Backend-only credential access pattern ensures tokens never leak to frontend.
---

