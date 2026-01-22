'use client'

import { cn } from '@/lib/cn'
import { useState } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'

// Placeholder types - will be replaced by actual types
interface ToolPolicy {
  allowed: string[]
  blocked: string[]
}

interface Constraint {
  id: string
  description: string
  violated: boolean
}

interface PendingSideEffect {
  id: string
  action_type: string
  description: string
  preview?: string
}

interface ResourceTelemetry {
  sandbox_alive: boolean
  elapsed_seconds: number
  cost_cents: number
}

interface InspectorProps {
  runId?: string
  state?: 'planning' | 'executing' | 'verifying' | 'awaiting_approval' | 'paused' | 'completed' | 'failed'
  toolPolicy?: ToolPolicy
  constraints?: Constraint[]
  pendingSideEffects?: PendingSideEffect[]
  telemetry?: ResourceTelemetry
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
  onRetry?: () => void
  className?: string
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
      {children}
    </h3>
  )
}

function ToolPolicySection({ policy }: { policy: ToolPolicy }) {
  return (
    <section className="mb-6">
      <SectionHeader>Tool Policy</SectionHeader>
      <div className="space-y-2 text-sm">
        {policy.allowed.length > 0 && (
          <div>
            <span className="text-green-600 dark:text-green-400">Allowed:</span>
            <div className="ml-2 text-[hsl(var(--muted-foreground))]">
              {policy.allowed.join(', ')}
            </div>
          </div>
        )}
        {policy.blocked.length > 0 && (
          <div>
            <span className="text-red-600 dark:text-red-400">Blocked:</span>
            <div className="ml-2 text-[hsl(var(--muted-foreground))]">
              {policy.blocked.join(', ')}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function ConstraintsSection({ constraints }: { constraints: Constraint[] }) {
  const violations = constraints.filter((c) => c.violated)
  const passing = constraints.filter((c) => !c.violated)

  return (
    <section className="mb-6">
      <SectionHeader>Constraints</SectionHeader>
      <div className="space-y-1 text-sm">
        {violations.map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-md bg-red-500/10 p-2">
            <span className="text-red-600 dark:text-red-400">✕</span>
            <span className="text-red-600 dark:text-red-400">{c.description}</span>
          </div>
        ))}
        {passing.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-[hsl(var(--muted-foreground))]">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>{c.description}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PendingSideEffectsSection({ effects }: { effects: PendingSideEffect[] }) {
  if (effects.length === 0) return null

  return (
    <section className="mb-6">
      <SectionHeader>Pending Actions</SectionHeader>
      <div className="space-y-2">
        {effects.map((effect) => (
          <div
            key={effect.id}
            className="rounded-md border border-orange-500/30 bg-orange-500/10 p-2 text-sm"
          >
            <div className="font-medium text-orange-600 dark:text-orange-400">
              {effect.action_type}
            </div>
            <div className="text-[hsl(var(--muted-foreground))]">{effect.description}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TelemetrySection({ telemetry }: { telemetry: ResourceTelemetry }) {
  return (
    <section className="mb-6">
      <SectionHeader>Resources</SectionHeader>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[hsl(var(--muted-foreground))]">Sandbox</span>
          <span className={telemetry.sandbox_alive ? 'text-green-600' : 'text-red-600'}>
            {telemetry.sandbox_alive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[hsl(var(--muted-foreground))]">Elapsed</span>
          <span className="tabular-nums">{formatDuration(telemetry.elapsed_seconds)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[hsl(var(--muted-foreground))]">Cost</span>
          <span className="tabular-nums">${(telemetry.cost_cents / 100).toFixed(2)}</span>
        </div>
      </div>
    </section>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function ControlButton({
  children,
  variant = 'default',
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  variant?: 'default' | 'destructive'
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex-1 rounded-md px-3 py-2 text-sm font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'destructive'
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90',
      )}
    >
      {children}
    </button>
  )
}

function StopConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-black/50" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[hsl(var(--background))] p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">Stop this run?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            This action cannot be undone. The run will be cancelled and any unsaved progress will be
            lost.
          </AlertDialog.Description>
          <div className="mt-6 flex gap-3">
            <AlertDialog.Close className="flex-1 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[hsl(var(--muted))]">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700"
            >
              Stop Run
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function Inspector({
  runId,
  state,
  toolPolicy,
  constraints,
  pendingSideEffects = [],
  telemetry,
  onPause,
  onResume,
  onStop,
  onRetry,
  className,
}: InspectorProps) {
  const [showStopDialog, setShowStopDialog] = useState(false)

  // No run selected
  if (!runId) {
    return (
      <div className={cn('flex h-full flex-col p-4', className)}>
        <SectionHeader>Inspector</SectionHeader>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a task to see details</p>
        </div>
      </div>
    )
  }

  const isActive = state && ['planning', 'executing', 'verifying'].includes(state)
  const isPaused = state === 'paused'
  const canRetry = state && ['failed', 'completed'].includes(state)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {toolPolicy && <ToolPolicySection policy={toolPolicy} />}
        {constraints && constraints.length > 0 && <ConstraintsSection constraints={constraints} />}
        <PendingSideEffectsSection effects={pendingSideEffects} />
        {telemetry && <TelemetrySection telemetry={telemetry} />}
      </div>

      {/* Fixed controls at bottom */}
      <div className="border-t border-[hsl(var(--border))] p-4">
        <SectionHeader>Controls</SectionHeader>
        <div className="flex gap-2">
          {isActive && (
            <ControlButton onClick={onPause} aria-label="Pause run">
              Pause
            </ControlButton>
          )}
          {isPaused && (
            <ControlButton onClick={onResume} aria-label="Resume run">
              Resume
            </ControlButton>
          )}
          {(isActive || isPaused) && (
            <ControlButton
              variant="destructive"
              onClick={() => setShowStopDialog(true)}
              aria-label="Stop run"
            >
              Stop
            </ControlButton>
          )}
          {canRetry && (
            <ControlButton onClick={onRetry} aria-label="Retry run">
              Retry
            </ControlButton>
          )}
        </div>
      </div>

      <StopConfirmDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        onConfirm={() => onStop?.()}
      />
    </div>
  )
}
