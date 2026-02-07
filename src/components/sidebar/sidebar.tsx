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
  executing: 'bg-green-500',
  verifying: 'bg-purple-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  awaiting_approval: 'bg-yellow-500',
}

function StatusBadge({ state }: { state: RunSummary['state'] }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', statusColors[state])}
      title={state.replace('_', ' ')}
    />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 px-4 font-pixel text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-muted-fg))]">
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
        'flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm',
        'transition-colors duration-150',
        active
          ? 'bg-[hsl(var(--sidebar-muted))] font-medium text-[hsl(var(--sidebar-fg))]'
          : 'text-[hsl(var(--sidebar-muted-fg))] hover:bg-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))]',
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
        'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left',
        'transition-colors duration-150',
        'text-[hsl(var(--sidebar-muted-fg))] hover:bg-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))]',
      )}
    >
      <StatusBadge state={run.state} />
      <span className="flex-1 truncate font-serif text-sm">{run.goal}</span>
    </button>
  )
}

function TemplateItem({ template, onClick }: { template: TemplateSummary; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm',
        'transition-colors duration-150',
        'text-[hsl(var(--sidebar-muted-fg))] hover:bg-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))]',
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
      {/* Header */}
      <div className="border-b border-[hsl(var(--sidebar-border))] p-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl text-[hsl(var(--sidebar-fg))]">Sapling</h1>
          <button
            type="button"
            onClick={onNewTask}
            aria-label="Create new task"
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              'transition-colors duration-150',
              'bg-[hsl(var(--sidebar-fg))] text-[hsl(var(--sidebar-bg))]',
              'hover:opacity-80',
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
              'mt-3 w-full rounded-lg border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-muted))] px-3 py-2 text-sm text-[hsl(var(--sidebar-fg))]',
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
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Active Runs */}
        {activeRuns.length > 0 && (
          <section className="mb-5">
            <SectionLabel>Active</SectionLabel>
            <div className="space-y-0.5">
              {activeRuns.map((run) => (
                <RunItem key={run.id} run={run} onClick={() => onRunSelect?.(run)} />
              ))}
            </div>
          </section>
        )}

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <section className="mb-5">
            <SectionLabel>Recent</SectionLabel>
            <div className="space-y-0.5">
              {recentRuns.map((run) => (
                <RunItem key={run.id} run={run} onClick={() => onRunSelect?.(run)} />
              ))}
            </div>
          </section>
        )}

        {/* Templates */}
        {templates.length > 0 && (
          <section className="mb-5">
            <SectionLabel>Templates</SectionLabel>
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
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="font-serif text-sm text-[hsl(var(--sidebar-muted-fg))]">No tasks yet</p>
            <button
              type="button"
              onClick={onNewTask}
              className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'transition-colors duration-150',
                'bg-[hsl(var(--sidebar-fg))] text-[hsl(var(--sidebar-bg))]',
                'hover:opacity-80',
              )}
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
              </span>
              Create your first task
            </button>
          </div>
        )}
      </nav>

      {/* Footer with approvals inbox */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <NavItem
          onClick={onApprovalsClick}
          badge={
            approvalCount > 0 ? (
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full',
                  'bg-green-500 font-pixel text-[10px] text-white',
                  'tabular-nums',
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
