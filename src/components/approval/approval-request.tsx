'use client'

import { cn } from '@/lib/cn'
import { useState, useEffect, useCallback } from 'react'
import type {
  PendingApproval,
  RejectionReason,
  ApprovalSource,
} from '@/services/approvals'

/**
 * Email preview data structure
 */
interface EmailPreview {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  html_body?: string
}

/**
 * PR diff preview data structure
 */
interface PRPreview {
  repo: string
  branch: string
  base: string
  title: string
  description: string
  files_changed: PRFileChange[]
  additions: number
  deletions: number
}

interface PRFileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  patch?: string
}

/**
 * Calendar event preview data structure
 */
interface CalendarPreview {
  title: string
  start_time: string
  end_time: string
  timezone: string
  attendees: CalendarAttendee[]
  location?: string
  description?: string
  conflicts?: CalendarConflict[]
}

interface CalendarAttendee {
  email: string
  name?: string
  status: 'pending' | 'accepted' | 'declined' | 'tentative'
}

interface CalendarConflict {
  title: string
  start_time: string
  end_time: string
}

/**
 * Props for the ApprovalRequest component
 */
interface ApprovalRequestProps {
  approval: PendingApproval
  onApprove: (checkpointId: string, source: ApprovalSource) => void
  onReject: (checkpointId: string, reason: RejectionReason, source: ApprovalSource) => void
  onEdit?: (checkpointId: string) => void
  className?: string
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
      {children}
    </h4>
  )
}

function TimeoutCountdown({
  expiresAt,
  onTimeout,
}: {
  expiresAt: string
  onTimeout?: () => void
}) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    const updateRemaining = () => {
      const now = Date.now()
      const expiry = new Date(expiresAt).getTime()
      const diff = Math.max(0, Math.floor((expiry - now) / 1000))
      setRemaining(diff)

      if (diff === 0 && onTimeout) {
        onTimeout()
      }
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onTimeout])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  const isUrgent = remaining < 60

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm tabular-nums',
        isUrgent
          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
      )}
    >
      <svg
        className="size-4"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
          clipRule="evenodd"
        />
      </svg>
      <span>
        {minutes}:{seconds.toString().padStart(2, '0')} remaining
      </span>
    </div>
  )
}

function EmailPreviewRenderer({ preview }: { preview: EmailPreview }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Recipients */}
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="w-12 shrink-0 text-[hsl(var(--muted-foreground))]">To:</span>
          <span className="flex flex-wrap gap-1">
            {preview.to.map((email) => (
              <span
                key={email}
                className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs"
              >
                {email}
              </span>
            ))}
          </span>
        </div>
        {preview.cc && preview.cc.length > 0 && (
          <div className="flex gap-2">
            <span className="w-12 shrink-0 text-[hsl(var(--muted-foreground))]">Cc:</span>
            <span className="flex flex-wrap gap-1">
              {preview.cc.map((email) => (
                <span
                  key={email}
                  className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs"
                >
                  {email}
                </span>
              ))}
            </span>
          </div>
        )}
        {preview.bcc && preview.bcc.length > 0 && (
          <div className="flex gap-2">
            <span className="w-12 shrink-0 text-[hsl(var(--muted-foreground))]">Bcc:</span>
            <span className="flex flex-wrap gap-1">
              {preview.bcc.map((email) => (
                <span
                  key={email}
                  className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs"
                >
                  {email}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Subject */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <SectionHeader>Subject</SectionHeader>
        <div className="text-sm font-medium">{preview.subject}</div>
      </div>

      {/* Body */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <SectionHeader>Body</SectionHeader>
        {preview.html_body ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: preview.html_body }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm">{preview.body}</div>
        )}
      </div>
    </div>
  )
}

function PRPreviewRenderer({ preview }: { preview: PRPreview }) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* PR metadata */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 font-mono text-xs">
            {preview.repo}
          </span>
          <span className="text-[hsl(var(--muted-foreground))]">
            {preview.base} ← {preview.branch}
          </span>
        </div>
        <div className="font-medium">{preview.title}</div>
        {preview.description && (
          <div className="text-[hsl(var(--muted-foreground))]">{preview.description}</div>
        )}
      </div>

      {/* Diff stats */}
      <div className="flex items-center gap-4 rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-sm">
        <span className="text-green-600 dark:text-green-400">+{preview.additions}</span>
        <span className="text-red-600 dark:text-red-400">-{preview.deletions}</span>
        <span className="text-[hsl(var(--muted-foreground))]">
          {preview.files_changed.length} file{preview.files_changed.length !== 1 ? 's' : ''} changed
        </span>
      </div>

      {/* Files changed */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <SectionHeader>Files Changed</SectionHeader>
        <div className="space-y-1">
          {preview.files_changed.map((file) => (
            <div key={file.path}>
              <button
                type="button"
                onClick={() => file.patch && toggleFile(file.path)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
                  'hover:bg-[hsl(var(--muted))]',
                  file.patch && 'cursor-pointer',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    file.status === 'added' && 'bg-green-500',
                    file.status === 'modified' && 'bg-yellow-500',
                    file.status === 'deleted' && 'bg-red-500',
                    file.status === 'renamed' && 'bg-blue-500',
                  )}
                />
                <span className="flex-1 truncate font-mono text-xs">{file.path}</span>
                <span className="text-xs text-green-600 dark:text-green-400">+{file.additions}</span>
                <span className="text-xs text-red-600 dark:text-red-400">-{file.deletions}</span>
                {file.patch && (
                  <svg
                    className={cn(
                      'size-4 text-[hsl(var(--muted-foreground))] transition-transform',
                      expandedFiles.has(file.path) && 'rotate-180',
                    )}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
              {file.patch && expandedFiles.has(file.path) && (
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-[hsl(var(--background))] p-2 font-mono text-xs">
                  {file.patch.split('\n').map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.startsWith('+') && !line.startsWith('+++') && 'bg-green-500/10 text-green-600 dark:text-green-400',
                        line.startsWith('-') && !line.startsWith('---') && 'bg-red-500/10 text-red-600 dark:text-red-400',
                        line.startsWith('@@') && 'text-[hsl(var(--muted-foreground))]',
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CalendarPreviewRenderer({ preview }: { preview: CalendarPreview }) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getDuration = () => {
    const start = new Date(preview.start_time)
    const end = new Date(preview.end_time)
    const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
    if (diffMinutes < 60) return `${diffMinutes} min`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Event title and time */}
      <div className="space-y-2">
        <div className="text-lg font-medium">{preview.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <span>{formatTime(preview.start_time)}</span>
          <span>→</span>
          <span>{formatTime(preview.end_time)}</span>
          <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
            {getDuration()}
          </span>
        </div>
        {preview.location && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="size-4 text-[hsl(var(--muted-foreground))]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
            </svg>
            <span>{preview.location}</span>
          </div>
        )}
      </div>

      {/* Attendees */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <SectionHeader>Attendees ({preview.attendees.length})</SectionHeader>
        <div className="flex flex-wrap gap-2">
          {preview.attendees.map((attendee) => (
            <div
              key={attendee.email}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1 text-sm',
                attendee.status === 'accepted' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                attendee.status === 'declined' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                attendee.status === 'tentative' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                attendee.status === 'pending' && 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
              )}
            >
              <span>{attendee.name || attendee.email}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conflicts warning */}
      {preview.conflicts && preview.conflicts.length > 0 && (
        <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <span>Calendar Conflicts</span>
          </div>
          <div className="mt-2 space-y-1">
            {preview.conflicts.map((conflict, i) => (
              <div key={i} className="text-sm text-[hsl(var(--muted-foreground))]">
                <span className="font-medium">{conflict.title}</span>
                <span className="mx-2">·</span>
                <span>
                  {formatTime(conflict.start_time)} - {formatTime(conflict.end_time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {preview.description && (
        <div className="border-t border-[hsl(var(--border))] pt-3">
          <SectionHeader>Description</SectionHeader>
          <div className="whitespace-pre-wrap text-sm">{preview.description}</div>
        </div>
      )}
    </div>
  )
}

function GenericPreviewRenderer({ preview }: { preview: Record<string, unknown> }) {
  return (
    <div className="rounded-md bg-[hsl(var(--muted))] p-3">
      <pre className="overflow-auto text-xs">
        {JSON.stringify(preview, null, 2)}
      </pre>
    </div>
  )
}

function ActionPreview({
  actionType,
  preview,
}: {
  actionType: string
  preview: Record<string, unknown>
}) {
  // Detect preview type and render appropriate component
  if (actionType === 'send_email' || isEmailPreview(preview)) {
    return <EmailPreviewRenderer preview={preview as unknown as EmailPreview} />
  }

  if (actionType === 'create_pr' || actionType === 'merge_pr' || isPRPreview(preview)) {
    return <PRPreviewRenderer preview={preview as unknown as PRPreview} />
  }

  if (actionType === 'create_event' || actionType === 'update_event' || isCalendarPreview(preview)) {
    return <CalendarPreviewRenderer preview={preview as unknown as CalendarPreview} />
  }

  return <GenericPreviewRenderer preview={preview} />
}

// Type guards for preview types
function isEmailPreview(preview: Record<string, unknown>): boolean {
  return 'to' in preview && 'subject' in preview && 'body' in preview
}

function isPRPreview(preview: Record<string, unknown>): boolean {
  return 'repo' in preview && 'branch' in preview && 'files_changed' in preview
}

function isCalendarPreview(preview: Record<string, unknown>): boolean {
  return 'title' in preview && 'start_time' in preview && 'attendees' in preview
}

function ActionButton({
  children,
  variant = 'default',
  onClick,
  disabled,
}: {
  children: React.ReactNode
  variant?: 'approve' | 'reject' | 'default'
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-md px-4 py-2 text-sm font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'approve' && 'bg-green-600 text-white hover:bg-green-700',
        variant === 'reject' && 'border border-red-600 text-red-600 hover:bg-red-600/10',
        variant === 'default' && 'border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
      )}
    >
      {children}
    </button>
  )
}

export function ApprovalRequest({
  approval,
  onApprove,
  onReject,
  onEdit,
  className,
}: ApprovalRequestProps) {
  const [isExpired, setIsExpired] = useState(false)

  const handleApprove = useCallback(() => {
    if (!isExpired) {
      onApprove(approval.checkpoint_id, 'web')
    }
  }, [approval.checkpoint_id, isExpired, onApprove])

  const handleReject = useCallback((reason: RejectionReason) => {
    if (!isExpired) {
      onReject(approval.checkpoint_id, reason, 'web')
    }
  }, [approval.checkpoint_id, isExpired, onReject])

  const handleEdit = useCallback(() => {
    if (!isExpired && onEdit) {
      // Reject with needs_edit reason, then open editor
      onReject(approval.checkpoint_id, 'needs_edit', 'web')
      onEdit(approval.checkpoint_id)
    }
  }, [approval.checkpoint_id, isExpired, onEdit, onReject])

  const actionTypeLabel = approval.action_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className={cn('flex flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-orange-500/10">
            <svg
              className="size-5 text-orange-600 dark:text-orange-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <div className="font-medium">Approval Required</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{actionTypeLabel}</div>
          </div>
        </div>
        <TimeoutCountdown
          expiresAt={approval.expires_at}
          onTimeout={() => setIsExpired(true)}
        />
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto p-4">
        <ActionPreview
          actionType={approval.action_type}
          preview={approval.preview}
        />
      </div>

      {/* Action buttons */}
      <div className="border-t border-[hsl(var(--border))] p-4">
        {isExpired ? (
          <div className="rounded-md bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400">
            This approval request has expired. The configured timeout action will be applied.
          </div>
        ) : (
          <div className="flex gap-3">
            <ActionButton variant="reject" onClick={() => handleReject('user_cancelled')}>
              Reject
            </ActionButton>
            {onEdit && (
              <ActionButton variant="default" onClick={handleEdit}>
                Edit
              </ActionButton>
            )}
            <ActionButton variant="approve" onClick={handleApprove}>
              Approve
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  )
}

// Export types for consumers
export type {
  ApprovalRequestProps,
  EmailPreview,
  PRPreview,
  PRFileChange,
  CalendarPreview,
  CalendarAttendee,
  CalendarConflict,
}
