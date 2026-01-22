**Completed Sapling-ly0: Implement E2B sandbox adapter**

Created `src/services/sandbox-adapter.ts` with:
- **SandboxAdapter class** - manages E2B sandbox lifecycle
- **File mounting** - reads local vault files, uploads to sandbox workspace
- **Streaming output** - EventEmitter pattern for stdout/stderr/result/error
- **Timeout handling** - configurable via contract or override (default 5 min)
- **Graceful shutdown** - extracts artifacts before killing sandbox
- **Crash recovery** - checkpoints capture state for recovery
- **Credential protection** - sanitizes env vars to block secrets

The adapter follows existing service patterns with typed interfaces and factory function.
