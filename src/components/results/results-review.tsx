'use client'

import { cn } from '@/lib/cn'
import { useState, useCallback } from 'react'
import type { ArtifactManifest, PreviewType } from '@/types'

/**
 * Receipt data - audit trail of what the agent did
 */
interface Receipt {
  files_read: number
  files_written: number
  actions_proposed: number
  actions_executed: number
}

/**
 * Props for the ResultsReview component
 */
interface ResultsReviewProps {
  runId: string
  artifacts: ArtifactManifest[]
  receipt: Receipt
  traceUrl?: string
  isRunning?: boolean
  onExportToVault?: (artifactIds: string[]) => void
  className?: string
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
      {children}
    </h3>
  )
}

/**
 * Get icon for artifact type
 */
function ArtifactIcon({ type }: { type: PreviewType }) {
  const iconClass = 'size-4'

  switch (type) {
    case 'email':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
          <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
            clipRule="evenodd"
          />
        </svg>
      )
    case 'markdown':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
            clipRule="evenodd"
          />
        </svg>
      )
    case 'diff':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06L6.28 5.22Z" />
          <path d="M11.47 5.22a.75.75 0 0 0 0 1.06l3.72 3.72-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25a.75.75 0 0 0-1.06 0Z" />
        </svg>
      )
    case 'json':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM6 13.25V6.75a.75.75 0 0 1 1.5 0v6.5a.75.75 0 0 1-1.5 0ZM10 13.25V6.75a.75.75 0 0 1 1.5 0v6.5a.75.75 0 0 1-1.5 0ZM14 7.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 14 7.5Z"
            clipRule="evenodd"
          />
        </svg>
      )
    case 'binary':
    default:
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Z"
            clipRule="evenodd"
          />
        </svg>
      )
  }
}

/**
 * Format file size in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get status badge color
 */
function StatusBadge({ status }: { status: 'draft' | 'final' | 'partial' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-pixel text-[10px] uppercase tracking-wide',
        status === 'final' && 'bg-green-500/10 text-green-600',
        status === 'draft' && 'bg-yellow-500/10 text-yellow-600',
        status === 'partial' && 'bg-red-500/10 text-red-600',
      )}
    >
      {status}
    </span>
  )
}

/**
 * Single artifact card in the deliverables list
 */
function ArtifactCard({
  artifact,
  selected,
  onSelect,
}: {
  artifact: ArtifactManifest
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(artifact.artifact_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(artifact.artifact_id)
        }
      }}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
        'transition-colors duration-150',
        selected
          ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))]/5'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]',
      )}
    >
      {/* Selection checkbox */}
      <div
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
          selected
            ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--muted-foreground))]',
        )}
      >
        {selected && (
          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="currentColor">
            <path d="M9.78 2.97a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L2.22 6.03a.75.75 0 0 1 1.06-1.06l1.72 1.72 3.72-3.72a.75.75 0 0 1 1.06 0Z" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        <ArtifactIcon type={artifact.preview_type} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-serif font-medium">
            {artifact.title || artifact.destination_path.split('/').pop()}
          </span>
          <StatusBadge status={artifact.status} />
        </div>
        {artifact.description && (
          <p className="mt-0.5 truncate text-pretty text-sm text-[hsl(var(--muted-foreground))]">
            {artifact.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 font-pixel text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="font-mono">{artifact.destination_path}</span>
          <span>{formatBytes(artifact.size_bytes)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Receipt summary showing audit trail
 */
function ReceiptSummary({ receipt }: { receipt: Receipt }) {
  return (
    <section>
      <SectionHeader>Receipt</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[hsl(var(--muted))] p-3">
          <div className="font-serif text-2xl tabular-nums">{receipt.files_read}</div>
          <div className="font-pixel text-[10px] text-[hsl(var(--muted-foreground))]">Files read</div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--muted))] p-3">
          <div className="font-serif text-2xl tabular-nums">{receipt.files_written}</div>
          <div className="font-pixel text-[10px] text-[hsl(var(--muted-foreground))]">Files written</div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--muted))] p-3">
          <div className="font-serif text-2xl tabular-nums">{receipt.actions_proposed}</div>
          <div className="font-pixel text-[10px] text-[hsl(var(--muted-foreground))]">Actions proposed</div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--muted))] p-3">
          <div className="font-serif text-2xl tabular-nums">{receipt.actions_executed}</div>
          <div className="font-pixel text-[10px] text-[hsl(var(--muted-foreground))]">Actions executed</div>
        </div>
      </div>
    </section>
  )
}

/**
 * Loading spinner
 */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/**
 * Empty state component
 */
function EmptyState({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      {isRunning ? (
        <>
          <Spinner className="size-8 text-green-500" />
          <div>
            <div className="font-serif font-medium">Working...</div>
            <div className="text-pretty text-sm text-[hsl(var(--muted-foreground))]">
              Deliverables will appear here as they are created
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex size-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
            <svg
              className="size-6 text-[hsl(var(--muted-foreground))]"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <div className="font-serif font-medium">No deliverables yet</div>
            <div className="text-pretty text-sm text-[hsl(var(--muted-foreground))]">
              Start a run to generate artifacts
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * ResultsReview component - displays run results with deliverables, receipt, and export
 */
export function ResultsReview({
  runId,
  artifacts,
  receipt,
  traceUrl,
  isRunning = false,
  onExportToVault,
  className,
}: ResultsReviewProps) {
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set())

  const toggleArtifact = useCallback((id: string) => {
    setSelectedArtifacts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedArtifacts(new Set(artifacts.map((a) => a.artifact_id)))
  }, [artifacts])

  const deselectAll = useCallback(() => {
    setSelectedArtifacts(new Set())
  }, [])

  const handleExport = useCallback(() => {
    if (onExportToVault && selectedArtifacts.size > 0) {
      onExportToVault(Array.from(selectedArtifacts))
    }
  }, [onExportToVault, selectedArtifacts])

  const hasArtifacts = artifacts.length > 0
  const allSelected = hasArtifacts && selectedArtifacts.size === artifacts.length

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-b border-[hsl(var(--border))] p-4">
        <h2 className="font-serif text-lg">Results</h2>
        <p className="font-pixel text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">Run {runId}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {!hasArtifacts && !isRunning ? (
          <EmptyState isRunning={isRunning} />
        ) : !hasArtifacts && isRunning ? (
          <EmptyState isRunning={isRunning} />
        ) : (
          <div className="space-y-6 p-4">
            {/* Deliverables section */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionHeader>
                  Deliverables ({artifacts.length})
                </SectionHeader>
                <button
                  type="button"
                  onClick={allSelected ? deselectAll : selectAll}
                  className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-2">
                {artifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.artifact_id}
                    artifact={artifact}
                    selected={selectedArtifacts.has(artifact.artifact_id)}
                    onSelect={toggleArtifact}
                  />
                ))}
              </div>
            </section>

            {/* Receipt section */}
            <ReceiptSummary receipt={receipt} />

            {/* Trace link */}
            {traceUrl && (
              <section>
                <SectionHeader>Audit Trail</SectionHeader>
                <a
                  href={traceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-3',
                    'text-sm transition-colors duration-150',
                    'hover:border-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>View decision trace for calibration</span>
                </a>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Fixed export button at bottom */}
      {hasArtifacts && onExportToVault && (
        <div className="border-t border-[hsl(var(--border))] p-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedArtifacts.size === 0}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2',
              'text-sm font-medium transition-colors duration-150',
              'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
              'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            Export to vault ({selectedArtifacts.size} selected)
          </button>
        </div>
      )}
    </div>
  )
}

// Export types for consumers
export type { ResultsReviewProps, Receipt }
