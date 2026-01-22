import { AppShell } from '@/components/layout'
import { Inspector } from '@/components/inspector'
import { Sidebar } from '@/components/sidebar'

// Demo data for sidebar
const demoTemplates = [
  { id: '1', name: 'Email Assistant', icon: '📧' },
  { id: '2', name: 'GitHub Issue Triage', icon: '🔍' },
  { id: '3', name: 'Calendar Scheduler', icon: '📅' },
]

function SidebarWrapper() {
  return (
    <Sidebar
      workspaces={[{ id: '1', name: 'Personal Vault' }]}
      workspace={{ id: '1', name: 'Personal Vault' }}
      templates={demoTemplates}
      approvalCount={0}
    />
  )
}

function MainContent() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <button
          type="button"
          className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))]"
        >
          New Task
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[hsl(var(--muted-foreground))]">No active tasks</p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Click &quot;New Task&quot; to get started
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return <AppShell sidebar={<SidebarWrapper />} main={<MainContent />} inspector={<Inspector />} />
}
