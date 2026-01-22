'use client'

import { cn } from '@/lib/cn'

// Placeholder types - will be replaced by actual types from src/types
interface Workspace {
  id: string
  name: string
}

interface RunSummary {
  id: string
  goal: string
  state: 'planning' | 'executing' | 'verifying' | 'completed' | 'failed' | 'awaiting_approval'
  template_name: string
}

interface TemplateSummary {
  id: string
  name: string
  icon?: string
}

interface SidebarProps {
  workspace?: Workspace
  workspaces?: Workspace[]
  activeRuns?: RunSummary[]
  recentRuns?: RunSummary[]
  templates?: TemplateSummary[]
  approvalCount?: number
  onWorkspaceChange?: (workspace: Workspace) => void
  onRunSelect?: (run: RunSummary) => void
  onTemplateSelect?: (template: TemplateSummary) => void
  onNewTask?: () => void
  onApprovalsClick?: () => void
  className?: string
}

// Status badge colors
const statusColors: Record<RunSummary['state'], string> = {
  planning: 'bg-blue-500',
  executing: 'bg-yellow-500',
  verifying: 'bg-purple-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  awaiting_approval: 'bg-orange-500',
}

function StatusBadge({ state }: { state: RunSummary['state'] }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', statusColors[state])}
      title={state.replace('_', ' ')}
    />
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
      {children}
    </h3>
  )
}

function NavItem({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  badge?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm',
        'transition-colors duration-150', // Max 200ms per ui-skills
        active
          ? 'bg-[hsl(var(--background))] font-medium'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))/50]',
      )}
    >
      <span className="truncate">{children}</span>
      {badge}
    </button>
  )
}

function RunItem({ run, onClick }: { run: RunSummary; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
        'transition-colors duration-150',
        'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))/50]',
      )}
    >
      <StatusBadge state={run.state} />
      <span className="flex-1 truncate">{run.goal}</span>
    </button>
  )
}

function TemplateItem({ template, onClick }: { template: TemplateSummary; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
        'transition-colors duration-150',
        'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))/50]',
      )}
    >
      {template.icon && <span>{template.icon}</span>}
      <span className="truncate">{template.name}</span>
    </button>
  )
}

export function Sidebar({
  workspace,
  workspaces = [],
  activeRuns = [],
  recentRuns = [],
  templates = [],
  approvalCount = 0,
  onWorkspaceChange,
  onRunSelect,
  onTemplateSelect,
  onNewTask,
  onApprovalsClick,
  className,
}: SidebarProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header with workspace selector */}
      <div className="border-b border-[hsl(var(--border))] p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Sapling</h1>
          <button
            type="button"
            onClick={onNewTask}
            aria-label="Create new task"
            className={cn(
              'flex size-8 items-center justify-center rounded-md',
              'transition-colors duration-150',
              'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]',
              'hover:opacity-90',
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </button>
        </div>

        {/* Workspace selector */}
        {workspaces.length > 0 && (
          <select
            value={workspace?.id}
            onChange={(e) => {
              const selected = workspaces.find((w) => w.id === e.target.value)
              if (selected) onWorkspaceChange?.(selected)
            }}
            className={cn(
              'mt-3 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]',
            )}
            aria-label="Select workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Scrollable navigation content */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Active Runs */}
        {activeRuns.length > 0 && (
          <section className="mb-4">
            <SectionHeader>Active</SectionHeader>
            <div className="space-y-0.5">
              {activeRuns.map((run) => (
                <RunItem key={run.id} run={run} onClick={() => onRunSelect?.(run)} />
              ))}
            </div>
          </section>
        )}

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <section className="mb-4">
            <SectionHeader>Recent</SectionHeader>
            <div className="space-y-0.5">
              {recentRuns.map((run) => (
                <RunItem key={run.id} run={run} onClick={() => onRunSelect?.(run)} />
              ))}
            </div>
          </section>
        )}

        {/* Templates */}
        {templates.length > 0 && (
          <section className="mb-4">
            <SectionHeader>Templates</SectionHeader>
            <div className="space-y-0.5">
              {templates.map((template) => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  onClick={() => onTemplateSelect?.(template)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {activeRuns.length === 0 && recentRuns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No tasks yet</p>
            <button
              type="button"
              onClick={onNewTask}
              className={cn(
                'mt-2 rounded-md px-3 py-1.5 text-sm font-medium',
                'transition-colors duration-150',
                'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]',
                'hover:opacity-90',
              )}
            >
              Create your first task
            </button>
          </div>
        )}
      </nav>

      {/* Footer with approvals inbox */}
      <div className="border-t border-[hsl(var(--border))] p-2">
        <NavItem
          onClick={onApprovalsClick}
          badge={
            approvalCount > 0 ? (
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full',
                  'bg-orange-500 text-xs font-medium text-white',
                  'tabular-nums', // Per ui-skills for counts
                )}
              >
                {approvalCount > 99 ? '99+' : approvalCount}
              </span>
            ) : undefined
          }
        >
          Approvals
        </NavItem>
      </div>
    </div>
  )
}
