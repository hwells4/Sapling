import { Sandbox } from '@e2b/code-interpreter'
import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'
import { type RunContract } from '../types'

/**
 * Sandbox output event types
 */
export type SandboxOutputType = 'stdout' | 'stderr' | 'result' | 'error'

/**
 * Output message from sandbox execution
 */
export interface SandboxOutput {
  type: SandboxOutputType
  timestamp: string
  data: string
}

/**
 * Artifact extracted from sandbox before shutdown
 */
export interface ExtractedArtifact {
  /** Path within sandbox where artifact was found */
  sandbox_path: string
  /** Content of the artifact */
  content: Buffer
  /** Size in bytes */
  size_bytes: number
}

/**
 * Result of a sandbox execution
 */
export interface SandboxExecutionResult {
  /** Whether execution completed successfully */
  success: boolean
  /** Exit code from the process */
  exit_code: number | null
  /** Error message if failed */
  error?: string
  /** Execution duration in milliseconds */
  duration_ms: number
  /** Extracted artifacts */
  artifacts: ExtractedArtifact[]
}

/**
 * Checkpoint data for crash recovery
 */
export interface SandboxCheckpoint {
  /** Run ID this checkpoint belongs to */
  run_id: string
  /** Sandbox ID for potential reconnection */
  sandbox_id: string
  /** Current phase */
  phase: string
  /** Files mounted at checkpoint time */
  mounted_files: string[]
  /** Artifacts produced so far */
  artifacts_so_far: string[]
  /** Timestamp of checkpoint */
  created_at: string
}

/**
 * Options for creating a sandbox
 */
export interface CreateSandboxOptions {
  /** Run ID for tracking */
  run_id: string
  /** Contract defining the run parameters */
  contract: RunContract
  /** Custom template ID (optional) */
  template_id?: string
  /** Timeout override in milliseconds */
  timeout_ms?: number
  /** API key for E2B (optional, uses env var if not provided) */
  api_key?: string
}

/**
 * Options for running code in the sandbox
 */
export interface RunCodeOptions {
  /** Code to execute */
  code: string
  /** Language (default: python) */
  language?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Timeout for this execution in ms */
  timeout_ms?: number
}

/**
 * Sandbox adapter state
 */
export type SandboxState = 'idle' | 'creating' | 'ready' | 'running' | 'extracting' | 'shutdown' | 'error'

/**
 * SandboxAdapter - manages E2B sandbox lifecycle
 *
 * Responsibilities:
 * - Create and destroy sandboxes
 * - Mount input files from vault
 * - Run agent code with streaming output
 * - Extract artifacts before cleanup
 * - Handle timeouts and crash recovery
 *
 * Security invariants:
 * - Never persist credentials in sandbox
 * - Always cleanup sandbox on error
 * - Checkpoint before external actions
 */
export class SandboxAdapter extends EventEmitter {
  private sandbox: Sandbox | null = null
  private _state: SandboxState = 'idle'
  private runId: string
  private contract: RunContract
  private templateId: string
  private timeoutMs: number
  private apiKey?: string
  private mountedFiles: string[] = []
  private timeoutHandle: NodeJS.Timeout | null = null
  private createdAt: string | null = null

  // Default timeout: 5 minutes
  private static readonly DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
  // Default sandbox template
  private static readonly DEFAULT_TEMPLATE = 'base'
  // Sandbox working directory
  private static readonly SANDBOX_WORKDIR = '/home/user/workspace'

  constructor(options: CreateSandboxOptions) {
    super()
    this.runId = options.run_id
    this.contract = options.contract
    this.templateId = options.template_id ?? SandboxAdapter.DEFAULT_TEMPLATE
    this.timeoutMs = options.timeout_ms ?? options.contract.max_duration_seconds * 1000
    this.apiKey = options.api_key
  }

  /**
   * Get current sandbox state
   */
  get state(): SandboxState {
    return this._state
  }

  /**
   * Get sandbox ID if created
   */
  get sandboxId(): string | null {
    return this.sandbox?.sandboxId ?? null
  }

  /**
   * Start the sandbox
   */
  async start(): Promise<void> {
    if (this._state !== 'idle') {
      throw new Error(`Cannot start sandbox in state: ${this._state}`)
    }

    this._state = 'creating'
    this.emit('state_changed', { state: this._state })

    try {
      // Create sandbox with E2B
      const createOptions: { apiKey?: string; template?: string } = {}
      if (this.apiKey) {
        createOptions.apiKey = this.apiKey
      }
      if (this.templateId !== SandboxAdapter.DEFAULT_TEMPLATE) {
        createOptions.template = this.templateId
      }

      this.sandbox = await Sandbox.create(createOptions)
      this.createdAt = new Date().toISOString()
      this._state = 'ready'
      this.emit('state_changed', { state: this._state, sandbox_id: this.sandbox.sandboxId })

      // Start global timeout
      this.startTimeout()
    } catch (error) {
      this._state = 'error'
      this.emit('state_changed', { state: this._state })
      throw this.wrapError('Failed to create sandbox', error)
    }
  }

  /**
   * Mount input files from local paths to sandbox
   */
  async mountFiles(localPaths: string[]): Promise<void> {
    if (this._state !== 'ready') {
      throw new Error(`Cannot mount files in state: ${this._state}`)
    }

    if (!this.sandbox) {
      throw new Error('Sandbox not initialized')
    }

    for (const localPath of localPaths) {
      try {
        // Read local file
        const content = await fs.readFile(localPath)

        // Determine sandbox destination path
        const filename = path.basename(localPath)
        const sandboxPath = `${SandboxAdapter.SANDBOX_WORKDIR}/inputs/${filename}`

        // Convert Buffer to ArrayBuffer for E2B SDK
        const arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)

        // Ensure directory exists in sandbox
        await this.sandbox.files.write(sandboxPath, arrayBuffer)

        this.mountedFiles.push(sandboxPath)
        this.emit('file_mounted', { local: localPath, sandbox: sandboxPath })
      } catch (error) {
        this.emit('mount_error', { path: localPath, error: this.getErrorMessage(error) })
        throw this.wrapError(`Failed to mount file: ${localPath}`, error)
      }
    }
  }

  /**
   * Run code in the sandbox with streaming output
   */
  async runCode(options: RunCodeOptions): Promise<SandboxExecutionResult> {
    if (this._state !== 'ready') {
      throw new Error(`Cannot run code in state: ${this._state}`)
    }

    if (!this.sandbox) {
      throw new Error('Sandbox not initialized')
    }

    this._state = 'running'
    this.emit('state_changed', { state: this._state })

    const startTime = Date.now()
    const artifacts: ExtractedArtifact[] = []

    try {
      const execution = await this.sandbox.runCode(options.code, {
        language: options.language ?? 'python',
        envs: this.sanitizeEnvVars(options.env ?? {}),
        timeoutMs: options.timeout_ms ?? this.timeoutMs,
        onStdout: (output) => {
          this.emitOutput('stdout', output.line)
        },
        onStderr: (output) => {
          this.emitOutput('stderr', output.line)
        },
        onResult: (result) => {
          this.emitOutput('result', JSON.stringify(result))
        },
        onError: (error) => {
          this.emitOutput('error', error.name + ': ' + error.value)
        },
      })

      const duration = Date.now() - startTime
      this._state = 'ready'
      this.emit('state_changed', { state: this._state })

      // Check for execution error
      if (execution.error) {
        return {
          success: false,
          exit_code: null,
          error: `${execution.error.name}: ${execution.error.value}`,
          duration_ms: duration,
          artifacts,
        }
      }

      return {
        success: true,
        exit_code: 0,
        duration_ms: duration,
        artifacts,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this._state = 'error'
      this.emit('state_changed', { state: this._state })

      return {
        success: false,
        exit_code: null,
        error: this.getErrorMessage(error),
        duration_ms: duration,
        artifacts,
      }
    }
  }

  /**
   * Extract artifacts from sandbox before shutdown
   */
  async extractArtifacts(sandboxPaths: string[]): Promise<ExtractedArtifact[]> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized')
    }

    if (this._state === 'shutdown') {
      throw new Error('Cannot extract artifacts after shutdown')
    }

    this._state = 'extracting'
    this.emit('state_changed', { state: this._state })

    const artifacts: ExtractedArtifact[] = []

    for (const sandboxPath of sandboxPaths) {
      try {
        // Read file from sandbox
        const content = await this.sandbox.files.read(sandboxPath)
        const buffer = Buffer.from(content)

        artifacts.push({
          sandbox_path: sandboxPath,
          content: buffer,
          size_bytes: buffer.length,
        })

        this.emit('artifact_extracted', { path: sandboxPath, size: buffer.length })
      } catch (error) {
        // Log but don't fail - artifact might not exist
        this.emit('extract_warning', { path: sandboxPath, error: this.getErrorMessage(error) })
      }
    }

    this._state = 'ready'
    this.emit('state_changed', { state: this._state })

    return artifacts
  }

  /**
   * List files in a sandbox directory
   */
  async listFiles(sandboxDir: string): Promise<string[]> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized')
    }

    try {
      const entries = await this.sandbox.files.list(sandboxDir)
      return entries.map((e) => `${sandboxDir}/${e.name}`)
    } catch {
      return []
    }
  }

  /**
   * Create a checkpoint for crash recovery
   */
  createCheckpoint(phase: string, artifactsSoFar: string[]): SandboxCheckpoint {
    return {
      run_id: this.runId,
      sandbox_id: this.sandboxId ?? 'unknown',
      phase,
      mounted_files: [...this.mountedFiles],
      artifacts_so_far: artifactsSoFar,
      created_at: new Date().toISOString(),
    }
  }

  /**
   * Gracefully shutdown the sandbox
   *
   * Order:
   * 1. Cancel timeout
   * 2. Extract any remaining artifacts
   * 3. Kill sandbox
   */
  async shutdown(): Promise<void> {
    // Cancel timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }

    // Skip if already shutdown or never created
    if (this._state === 'shutdown' || !this.sandbox) {
      this._state = 'shutdown'
      return
    }

    this._state = 'shutdown'
    this.emit('state_changed', { state: this._state })

    try {
      await this.sandbox.kill()
      this.emit('shutdown_complete', { sandbox_id: this.sandboxId })
    } catch (error) {
      // Log but don't rethrow - sandbox might already be dead
      this.emit('shutdown_error', { error: this.getErrorMessage(error) })
    } finally {
      this.sandbox = null
    }
  }

  /**
   * Force kill sandbox immediately (for crash recovery)
   */
  async forceKill(): Promise<void> {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }

    if (this.sandbox) {
      try {
        await this.sandbox.kill()
      } catch {
        // Ignore errors on force kill
      }
      this.sandbox = null
    }

    this._state = 'shutdown'
    this.emit('state_changed', { state: this._state })
  }

  // ------- Private helpers -------

  private startTimeout(): void {
    this.timeoutHandle = setTimeout(() => {
      this.emit('timeout', { timeout_ms: this.timeoutMs })
      this.forceKill()
    }, this.timeoutMs)
  }

  private emitOutput(type: SandboxOutputType, data: string): void {
    const output: SandboxOutput = {
      type,
      timestamp: new Date().toISOString(),
      data,
    }
    this.emit('output', output)
  }

  private sanitizeEnvVars(env: Record<string, string>): Record<string, string> {
    // Never pass credentials into sandbox
    const sanitized: Record<string, string> = {}
    const blockedPrefixes = ['E2B_', 'AWS_', 'OPENAI_', 'ANTHROPIC_', 'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD']

    for (const [key, value] of Object.entries(env)) {
      const upperKey = key.toUpperCase()
      const isBlocked = blockedPrefixes.some(
        (prefix) => upperKey.startsWith(prefix) || upperKey.includes('_KEY') || upperKey.includes('_SECRET'),
      )
      if (!isBlocked) {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private wrapError(message: string, error: unknown): Error {
    const originalMessage = this.getErrorMessage(error)
    const wrapped = new Error(`${message}: ${originalMessage}`)
    if (error instanceof Error) {
      wrapped.stack = error.stack
    }
    return wrapped
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}

/**
 * Factory function for creating SandboxAdapter instances
 */
export function createSandboxAdapter(options: CreateSandboxOptions): SandboxAdapter {
  return new SandboxAdapter(options)
}
