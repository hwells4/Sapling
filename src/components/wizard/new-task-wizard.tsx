'use client'

import { cn } from '@/lib/cn'
import { useState, useCallback } from 'react'
import type {
  AgentTemplateRef,
  TemplateCatalogEntry,
} from '@/types/template'
import type { RunContract, IntegrationScope } from '@/types/contract'

// Wizard step definitions
type WizardStep = 'goal' | 'template' | 'scope' | 'confirm'

const STEPS: WizardStep[] = ['goal', 'template', 'scope', 'confirm']

const STEP_LABELS: Record<WizardStep, string> = {
  goal: 'What do you want done?',
  template: 'Choose a helper',
  scope: 'Where should it work?',
  confirm: 'Review and confirm',
}

// Input state for the wizard
interface WizardState {
  goal: string
  template: TemplateCatalogEntry | null
  scopes: IntegrationScope[]
}

interface NewTaskWizardProps {
  templates: TemplateCatalogEntry[]
  availableScopes: IntegrationScope[]
  onSubmit: (state: WizardState) => void
  onCancel: () => void
  className?: string
  // Optional: pre-generated contract preview based on selections
  contractPreview?: Partial<RunContract>
}

function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: readonly WizardStep[]
  currentIndex: number
}) {
  return (
    <div className="flex items-center gap-2" role="navigation" aria-label="Wizard progress">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          {index > 0 && (
            <div
              className={cn(
                'mx-2 h-px w-8',
                index <= currentIndex
                  ? 'bg-[hsl(var(--foreground))]'
                  : 'bg-[hsl(var(--border))]',
              )}
            />
          )}
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-sm font-medium',
              index < currentIndex
                ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                : index === currentIndex
                  ? 'border-2 border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
                  : 'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]',
            )}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            {index < currentIndex ? (
              <svg
                className="size-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              index + 1
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function GoalStep({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="goal-input" className="text-sm text-[hsl(var(--muted-foreground))]">
        Describe what you want the agent to accomplish
      </label>
      <textarea
        id="goal-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Draft a weekly status email summarizing my GitHub activity..."
        className={cn(
          'min-h-32 w-full resize-none rounded-md border border-[hsl(var(--border))]',
          'bg-[hsl(var(--background))] px-3 py-2 text-sm',
          'placeholder:text-[hsl(var(--muted-foreground))]',
          'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]',
        )}
        autoFocus
      />
    </div>
  )
}

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: TemplateCatalogEntry
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-start gap-2 rounded-lg border p-4 text-left',
        'transition-colors duration-150',
        selected
          ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--muted))]'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))/50] hover:bg-[hsl(var(--muted))/50]',
      )}
    >
      <div className="flex items-center gap-2">
        {template.icon && <span className="text-lg">{template.icon}</span>}
        <span className="font-medium">{template.name}</span>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{template.description}</p>
      {template.capabilities && template.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]"
            >
              {cap}
            </span>
          ))}
        </div>
      )}
      {template.estimated_cost_range && (
        <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          Est. ${(template.estimated_cost_range.min_cents / 100).toFixed(2)} - $
          {(template.estimated_cost_range.max_cents / 100).toFixed(2)}
        </span>
      )}
    </button>
  )
}

function TemplateStep({
  templates,
  selected,
  onSelect,
}: {
  templates: TemplateCatalogEntry[]
  selected: TemplateCatalogEntry | null
  onSelect: (template: TemplateCatalogEntry) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Select a template that best matches your task
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard
            key={template.template_id}
            template={template}
            selected={selected?.template_id === template.template_id}
            onClick={() => onSelect(template)}
          />
        ))}
      </div>
      {templates.length === 0 && (
        <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No templates available. Create one to get started.
          </p>
        </div>
      )}
    </div>
  )
}

function ScopeToggle({
  scope,
  selected,
  onToggle,
}: {
  scope: IntegrationScope
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 rounded-md border px-4 py-3 text-left',
        'transition-colors duration-150',
        selected
          ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--muted))]'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))/50]',
      )}
    >
      <div
        className={cn(
          'flex size-5 items-center justify-center rounded border',
          selected
            ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--border))]',
        )}
      >
        {selected && (
          <svg
            className="size-3 text-[hsl(var(--background))]"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium capitalize">{scope.system}</div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">{scope.scope}</div>
      </div>
    </button>
  )
}

function ScopeStep({
  availableScopes,
  selectedScopes,
  onToggle,
}: {
  availableScopes: IntegrationScope[]
  selectedScopes: IntegrationScope[]
  onToggle: (scope: IntegrationScope) => void
}) {
  const isSelected = (scope: IntegrationScope) =>
    selectedScopes.some((s) => s.system === scope.system && s.scope === scope.scope)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Select the integrations this task can access
      </p>
      <div className="flex flex-col gap-2">
        {availableScopes.map((scope) => (
          <ScopeToggle
            key={`${scope.system}:${scope.scope}`}
            scope={scope}
            selected={isSelected(scope)}
            onToggle={() => onToggle(scope)}
          />
        ))}
      </div>
      {availableScopes.length === 0 && (
        <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No integrations connected. Connect services in Settings.
          </p>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
      {children}
    </h4>
  )
}

function ConfirmStep({
  state,
  contractPreview,
}: {
  state: WizardState
  contractPreview?: Partial<RunContract>
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Review the task configuration before starting
      </p>

      {/* Goal summary */}
      <section>
        <SectionHeader>Goal</SectionHeader>
        <div className="rounded-md bg-[hsl(var(--muted))] p-3 text-sm">{state.goal}</div>
      </section>

      {/* Template summary */}
      {state.template && (
        <section>
          <SectionHeader>Helper</SectionHeader>
          <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] p-3">
            {state.template.icon && <span>{state.template.icon}</span>}
            <span className="text-sm font-medium">{state.template.name}</span>
          </div>
        </section>
      )}

      {/* Scopes summary */}
      {state.scopes.length > 0 && (
        <section>
          <SectionHeader>Integrations</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {state.scopes.map((scope) => (
              <span
                key={`${scope.system}:${scope.scope}`}
                className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm capitalize"
              >
                {scope.system}: {scope.scope}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Contract preview - read only */}
      {contractPreview && (
        <section>
          <SectionHeader>Permissions</SectionHeader>
          <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
            {contractPreview.tool_policy && (
              <div className="mb-2">
                <span className="text-[hsl(var(--muted-foreground))]">Tools: </span>
                {contractPreview.tool_policy.allowed.length > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    {contractPreview.tool_policy.allowed.length} allowed
                  </span>
                )}
                {contractPreview.tool_policy.blocked.length > 0 && (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    {contractPreview.tool_policy.blocked.length} blocked
                  </span>
                )}
              </div>
            )}
            {contractPreview.constraints && contractPreview.constraints.length > 0 && (
              <div className="mb-2">
                <span className="text-[hsl(var(--muted-foreground))]">Constraints: </span>
                <span>{contractPreview.constraints.length} rules</span>
              </div>
            )}
            {contractPreview.approval_rules && contractPreview.approval_rules.length > 0 && (
              <div className="mb-2">
                <span className="text-[hsl(var(--muted-foreground))]">Approvals: </span>
                <span>{contractPreview.approval_rules.length} checkpoints</span>
              </div>
            )}
            {contractPreview.max_duration_seconds && (
              <div>
                <span className="text-[hsl(var(--muted-foreground))]">Time limit: </span>
                <span className="tabular-nums">
                  {Math.floor(contractPreview.max_duration_seconds / 60)} min
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Trust notice - non-negotiable */}
      <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-600 dark:text-orange-400">
        By starting this task, you agree to the permissions and constraints above. The agent will
        request approval for sensitive actions.
      </div>
    </div>
  )
}

export function NewTaskWizard({
  templates,
  availableScopes,
  onSubmit,
  onCancel,
  className,
  contractPreview,
}: NewTaskWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('goal')
  const [state, setState] = useState<WizardState>({
    goal: '',
    template: null,
    scopes: [],
  })

  const currentIndex = STEPS.indexOf(currentStep)

  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 'goal':
        return state.goal.trim().length > 0
      case 'template':
        return state.template !== null
      case 'scope':
        // Scopes are optional
        return true
      case 'confirm':
        return true
      default:
        return false
    }
  }, [currentStep, state])

  const goNext = useCallback(() => {
    const nextIndex = currentIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
    }
  }, [currentIndex])

  const goBack = useCallback(() => {
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex])
    }
  }, [currentIndex])

  const handleSubmit = useCallback(() => {
    onSubmit(state)
  }, [state, onSubmit])

  const toggleScope = useCallback((scope: IntegrationScope) => {
    setState((prev) => {
      const exists = prev.scopes.some(
        (s) => s.system === scope.system && s.scope === scope.scope,
      )
      if (exists) {
        return {
          ...prev,
          scopes: prev.scopes.filter(
            (s) => !(s.system === scope.system && s.scope === scope.scope),
          ),
        }
      }
      return { ...prev, scopes: [...prev.scopes, scope] }
    })
  }, [])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-b border-[hsl(var(--border))] p-6">
        <h2 className="mb-4 text-lg font-semibold">New Task</h2>
        <StepIndicator steps={STEPS} currentIndex={currentIndex} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="mb-4 text-base font-medium">{STEP_LABELS[currentStep]}</h3>
        {currentStep === 'goal' && (
          <GoalStep
            value={state.goal}
            onChange={(goal) => setState((prev) => ({ ...prev, goal }))}
          />
        )}
        {currentStep === 'template' && (
          <TemplateStep
            templates={templates}
            selected={state.template}
            onSelect={(template) => setState((prev) => ({ ...prev, template }))}
          />
        )}
        {currentStep === 'scope' && (
          <ScopeStep
            availableScopes={availableScopes}
            selectedScopes={state.scopes}
            onToggle={toggleScope}
          />
        )}
        {currentStep === 'confirm' && (
          <ConfirmStep state={state} contractPreview={contractPreview} />
        )}
      </div>

      {/* Footer with navigation */}
      <div className="flex items-center justify-between border-t border-[hsl(var(--border))] p-4">
        <button
          type="button"
          onClick={currentIndex === 0 ? onCancel : goBack}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium',
            'transition-colors duration-150',
            'border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
          )}
        >
          {currentIndex === 0 ? 'Cancel' : 'Back'}
        </button>
        {currentStep === 'confirm' ? (
          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium',
              'transition-colors duration-150',
              'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]',
              'hover:opacity-90',
            )}
          >
            Start Task
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext()}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium',
              'transition-colors duration-150',
              'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]',
              'hover:opacity-90',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Next
          </button>
        )}
      </div>
    </div>
  )
}

// Export types for consumers
export type { WizardState, NewTaskWizardProps }
