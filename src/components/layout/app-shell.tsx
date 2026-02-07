'use client'

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface AppShellProps {
  sidebar: ReactNode
  main: ReactNode
  inspector?: ReactNode
  className?: string
}

/**
 * Three-pane application shell with editorial warm aesthetic.
 *
 * Three-surface layering:
 * - Left: Dark sidebar (near-black with warm undertone)
 * - Center: Warm cream main area
 * - Right: White inspector panel
 */
export function AppShell({ sidebar, main, inspector, className }: AppShellProps) {
  return (
    <div
      className={cn(
        'flex h-dvh w-full overflow-hidden',
        'safe-area-inset',
        className,
      )}
    >
      {/* Left Sidebar — dark surface */}
      <aside
        className={cn(
          'flex h-full w-72 shrink-0 flex-col',
          'bg-[hsl(var(--sidebar-bg))]',
        )}
      >
        {sidebar}
      </aside>

      {/* Center Main Content — warm cream */}
      <main className="flex h-full flex-1 flex-col overflow-hidden bg-[hsl(var(--background))]">
        {main}
      </main>

      {/* Right Inspector Panel — white card surface */}
      {inspector && (
        <aside
          className={cn(
            'flex h-full w-80 shrink-0 flex-col',
            'border-l border-[hsl(var(--border))]',
            'bg-[hsl(var(--card))]',
          )}
        >
          {inspector}
        </aside>
      )}
    </div>
  )
}
