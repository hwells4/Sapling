import { AppShell } from '@/components/layout'

// Placeholder components - will be replaced by actual implementations
function Sidebar() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Sapling</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        <div className="rounded-md bg-[hsl(var(--background))] px-3 py-2 text-sm font-medium">
          Tasks
        </div>
        <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">Library</div>
        <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">Templates</div>
        <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">Connections</div>
      </nav>
      <div className="border-t border-[hsl(var(--border))] pt-4">
        <div className="text-xs text-[hsl(var(--muted-foreground))]">Approvals</div>
      </div>
    </div>
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

function Inspector() {
  return (
    <div className="flex h-full flex-col p-4">
      <h3 className="mb-4 text-sm font-medium">Inspector</h3>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a task to see details</p>
      </div>
    </div>
  )
}

export default function Home() {
  return <AppShell sidebar={<Sidebar />} main={<MainContent />} inspector={<Inspector />} />
}
