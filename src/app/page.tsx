'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout'
import { Inspector } from '@/components/inspector'
import { Sidebar } from '@/components/sidebar'
import { NewTaskWizard } from '@/components/wizard'

// Demo data for sidebar
const demoTemplates = [
  { id: '1', name: 'Email Assistant', icon: '📧' },
  { id: '2', name: 'GitHub Issue Triage', icon: '🔍' },
  { id: '3', name: 'Calendar Scheduler', icon: '📅' },
]

// Demo templates for the wizard (full catalog entries)
const demoCatalogTemplates = [
  {
    template_id: '1',
    version: '1.0.0',
    name: 'Email Assistant',
    description: 'Draft and send emails based on your instructions',
    icon: '📧',
    capabilities: ['email', 'drafting'],
    estimated_cost_range: { min_cents: 5, max_cents: 25 },
  },
  {
    template_id: '2',
    version: '1.0.0',
    name: 'GitHub Issue Triage',
    description: 'Categorize and prioritize GitHub issues across repos',
    icon: '🔍',
    capabilities: ['github', 'triage', 'labeling'],
    estimated_cost_range: { min_cents: 10, max_cents: 50 },
  },
  {
    template_id: '3',
    version: '1.0.0',
    name: 'Calendar Scheduler',
    description: 'Find optimal meeting times and create calendar events',
    icon: '📅',
    capabilities: ['calendar', 'scheduling'],
    estimated_cost_range: { min_cents: 3, max_cents: 15 },
  },
]

const demoScopes = [
  { system: 'gmail' as const, scope: 'send' as const },
  { system: 'github' as const, scope: 'read' as const },
  { system: 'calendar' as const, scope: 'write' as const },
]

export default function Home() {
  const [wizardOpen, setWizardOpen] = useState(false)

  function SidebarWrapper() {
    return (
      <Sidebar
        workspaces={[{ id: '1', name: 'Personal Vault' }]}
        workspace={{ id: '1', name: 'Personal Vault' }}
        templates={demoTemplates}
        approvalCount={0}
        onNewTask={() => setWizardOpen(true)}
      />
    )
  }

  function MainContent() {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="font-serif text-xl">Tasks</h2>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-colors duration-150 hover:opacity-90"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            New Task
          </button>
        </header>
        <div className="relative flex flex-1 items-center justify-center p-6">
          <span className="step-watermark">01</span>
          <div className="relative z-10 text-center">
            <h3 className="text-balance font-serif text-2xl">Begin something new</h3>
            <p className="mt-2 text-pretty text-sm text-[hsl(var(--muted-foreground))]">
              Create a task to have an agent work on your behalf
            </p>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-6 inline-flex items-center gap-2.5 rounded-lg bg-[hsl(var(--accent))] px-6 py-3 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-colors duration-150 hover:opacity-90"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              New Task
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <AppShell sidebar={<SidebarWrapper />} main={<MainContent />} inspector={<Inspector />} />

      {/* Wizard modal overlay */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Dark scrim */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setWizardOpen(false)}
            aria-hidden="true"
          />
          {/* Wizard panel */}
          <div className="relative z-10 h-[min(85vh,700px)] w-full max-w-2xl overflow-hidden rounded-2xl bg-[hsl(var(--card))] shadow-2xl">
            <NewTaskWizard
              templates={demoCatalogTemplates}
              availableScopes={demoScopes}
              onSubmit={(state) => {
                console.log('Task submitted:', state)
                setWizardOpen(false)
              }}
              onCancel={() => setWizardOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
