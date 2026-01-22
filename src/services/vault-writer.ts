import { createHash } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  type ArtifactManifest,
  type ArtifactStatus,
  type ArtifactType,
  MIME_TYPES,
  createArtifactManifest,
} from '../types/artifact'

/**
 * Options for writing an artifact to the vault
 */
export interface WriteArtifactOptions {
  /** Run ID this artifact belongs to */
  run_id: string
  /** Agent that produced this artifact */
  agent: string
  /** Source context (e.g., goal summary) */
  source: string
  /** Human-readable title for the artifact */
  title: string
  /** Artifact type */
  type: ArtifactType
  /** Artifact status */
  status: ArtifactStatus
  /** Optional description */
  description?: string
  /** Optional custom MIME type (inferred from type if not provided) */
  mime_type?: string
}

/**
 * Result of a vault write operation
 */
export interface WriteResult {
  success: boolean
  manifest?: ArtifactManifest
  error?: string
}

/**
 * VaultWriter - writes artifacts to the Obsidian vault
 *
 * Outputs are written to brain/outputs/YYYY/MM/<run_id>_<slug>.md
 * with YAML frontmatter containing metadata.
 *
 * Features:
 * - Atomic writes (write to .tmp, then rename)
 * - Overwrite protection (appends -2, -3, etc. on collision)
 * - Filename normalization (slugify, max 100 chars)
 * - YAML frontmatter with run_id, agent, source, created_at, status
 */
export class VaultWriter {
  private readonly vaultPath: string
  private readonly outputsDir: string

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
    this.outputsDir = path.join(vaultPath, 'outputs')
  }

  /**
   * Write an artifact to the vault
   *
   * @param content - The content to write
   * @param options - Artifact metadata options
   * @returns WriteResult with manifest on success
   */
  async writeArtifact(content: string, options: WriteArtifactOptions): Promise<WriteResult> {
    try {
      // Generate destination path
      const destPath = await this.generateDestinationPath(options.run_id, options.title)

      // Ensure directory exists
      const dirPath = path.dirname(destPath)
      await fs.mkdir(dirPath, { recursive: true })

      // Build content with frontmatter
      const fullContent = this.buildContentWithFrontmatter(content, options)

      // Calculate checksum and size
      const checksum = this.calculateChecksum(fullContent)
      const sizeBytes = Buffer.byteLength(fullContent, 'utf8')

      // Atomic write: write to temp file, then rename
      const tmpPath = `${destPath}.tmp`
      await fs.writeFile(tmpPath, fullContent, 'utf8')
      await fs.rename(tmpPath, destPath)

      // Build manifest
      const relativePath = path.relative(this.vaultPath, destPath)
      const mimeType = options.mime_type ?? this.getMimeType(options.type)

      const manifest = createArtifactManifest({
        run_id: options.run_id,
        type: options.type,
        mime_type: mimeType,
        destination_path: relativePath,
        checksum,
        size_bytes: sizeBytes,
        status: options.status,
        title: options.title,
        description: options.description,
      })

      return { success: true, manifest }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a unique destination path for the artifact
   *
   * Format: brain/outputs/YYYY/MM/<run_id>_<slug>.md
   * Handles collisions by appending -2, -3, etc.
   */
  private async generateDestinationPath(runId: string, title: string): Promise<string> {
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    const slug = this.slugify(title)
    const shortRunId = runId.slice(0, 8) // Use first 8 chars of run_id
    const baseFilename = `${shortRunId}_${slug}`

    const dirPath = path.join(this.outputsDir, year, month)

    // Try base filename first, then with suffixes
    let filename = `${baseFilename}.md`
    let fullPath = path.join(dirPath, filename)
    let suffix = 1

    while (await this.fileExists(fullPath)) {
      suffix++
      filename = `${baseFilename}-${suffix}.md`
      fullPath = path.join(dirPath, filename)
    }

    return fullPath
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Convert title to URL-safe slug
   *
   * - Lowercase
   * - Replace spaces/special chars with hyphens
   * - Remove consecutive hyphens
   * - Max 100 characters
   * - Remove leading/trailing hyphens
   */
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/-+/g, '-') // Remove consecutive hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .slice(0, 100) // Max 100 chars
  }

  /**
   * Build content with YAML frontmatter
   */
  private buildContentWithFrontmatter(content: string, options: WriteArtifactOptions): string {
    const createdAt = new Date().toISOString()

    const frontmatter = [
      '---',
      `run_id: ${options.run_id}`,
      `agent: ${options.agent}`,
      `source: "${this.escapeYamlString(options.source)}"`,
      `created_at: ${createdAt}`,
      `status: ${options.status}`,
      `type: ${options.type}`,
      options.description ? `description: "${this.escapeYamlString(options.description)}"` : null,
      '---',
    ]
      .filter(Boolean)
      .join('\n')

    return `${frontmatter}\n\n${content}`
  }

  /**
   * Escape special characters for YAML string values
   */
  private escapeYamlString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
  }

  /**
   * Calculate SHA256 checksum of content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }

  /**
   * Get MIME type for artifact type
   */
  private getMimeType(type: ArtifactType): string {
    switch (type) {
      case 'markdown':
        return MIME_TYPES.markdown
      case 'email_draft':
        return MIME_TYPES.text
      case 'calendar_event':
        return MIME_TYPES.json
      case 'pr_diff':
        return MIME_TYPES.text
      case 'json_data':
        return MIME_TYPES.json
      case 'pdf':
        return MIME_TYPES.pdf
      case 'image':
        return MIME_TYPES.png
    }
  }
}

/**
 * Factory function for creating VaultWriter instances
 */
export function createVaultWriter(vaultPath: string): VaultWriter {
  return new VaultWriter(vaultPath)
}
