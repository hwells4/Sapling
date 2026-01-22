import { z } from 'zod'

// Artifact types - what the artifact represents
export const ArtifactType = z.enum([
  'markdown',
  'email_draft',
  'calendar_event',
  'pr_diff',
  'json_data',
  'pdf',
  'image',
])
export type ArtifactType = z.infer<typeof ArtifactType>

// Preview types - how the UI should render the artifact
export const PreviewType = z.enum([
  'email',
  'calendar',
  'markdown',
  'diff',
  'json',
  'binary',
])
export type PreviewType = z.infer<typeof PreviewType>

// Artifact status - lifecycle state
export const ArtifactStatus = z.enum([
  'draft', // Work in progress, may change
  'final', // Complete and immutable
  'partial', // Run failed, artifact incomplete
])
export type ArtifactStatus = z.infer<typeof ArtifactStatus>

// SHA256 checksum format (64 hex characters)
const SHA256Checksum = z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA256 checksum format')

/**
 * ArtifactManifest - durable output metadata.
 *
 * The manifest provides stable artifact ids, preview hints, and checksums
 * so the UI can render and export correctly without parsing file contents.
 *
 * Emitted with `artifact.created` event for live updates.
 */
export const ArtifactManifestSchema = z.object({
  // Identity
  artifact_id: z.string().uuid(),
  run_id: z.string(),

  // Type information
  type: ArtifactType,
  mime_type: z.string(), // e.g., 'text/markdown', 'application/json'
  preview_type: PreviewType,

  // Location
  destination_path: z.string(), // Vault path where artifact is written

  // Integrity
  checksum: SHA256Checksum,
  size_bytes: z.number().int().nonnegative(),

  // Metadata
  created_at: z.string().datetime(), // ISO 8601
  status: ArtifactStatus,

  // Optional display info
  title: z.string().optional(),
  description: z.string().optional(),
})
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>

// Common MIME types for quick reference
export const MIME_TYPES = {
  markdown: 'text/markdown',
  json: 'application/json',
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  text: 'text/plain',
} as const

// Map artifact type to default preview type
export function getDefaultPreviewType(artifactType: ArtifactType): PreviewType {
  switch (artifactType) {
    case 'markdown':
      return 'markdown'
    case 'email_draft':
      return 'email'
    case 'calendar_event':
      return 'calendar'
    case 'pr_diff':
      return 'diff'
    case 'json_data':
      return 'json'
    case 'pdf':
    case 'image':
      return 'binary'
  }
}

// Validation helpers
export function validateArtifactManifest(data: unknown): ArtifactManifest {
  return ArtifactManifestSchema.parse(data)
}

export function isValidArtifactManifest(data: unknown): data is ArtifactManifest {
  return ArtifactManifestSchema.safeParse(data).success
}

// Create a new artifact manifest with defaults
export function createArtifactManifest(
  params: Omit<ArtifactManifest, 'artifact_id' | 'created_at' | 'preview_type'> & {
    preview_type?: PreviewType
  },
): ArtifactManifest {
  return {
    ...params,
    artifact_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    preview_type: params.preview_type ?? getDefaultPreviewType(params.type),
  }
}
