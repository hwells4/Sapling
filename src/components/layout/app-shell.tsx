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
 * Three-pane application shell inspired by Cursor's layout.
 *
 * Layout:
 * - Left: Sidebar (work + library) - collapsible
 * - Center: Main content (run canvas)
 * - Right: Inspector panel (compliance + controls) - collapsible
 *
 * Uses h-dvh instead of h-screen per ui-skills constraint.
 * Respects safe-area-inset for fixed elements.
 */
export function AppShell({ sidebar, main, inspector, className }: AppShellProps) {
  return (
    <div
      className={cn(
        'flex h-dvh w-full overflow-hidden',
        // Respect safe-area-inset for mobile
        'safe-area-inset',
        className,
      )}
    >
      {/* Left Sidebar */}
      <aside
        className={cn(
          'flex h-full w-64 shrink-0 flex-col',
          'border-r border-[hsl(var(--border))]',
          'bg-[hsl(var(--muted))]',
        )}
      >
        {sidebar}
      </aside>

      {/* Center Main Content */}
      <main className="flex h-full flex-1 flex-col overflow-hidden">{main}</main>

      {/* Right Inspector Panel */}
      {inspector && (
        <aside
          className={cn(
            'flex h-full w-80 shrink-0 flex-col',
            'border-l border-[hsl(var(--border))]',
            'bg-[hsl(var(--muted))]',
          )}
        >
          {inspector}
        </aside>
      )}
    </div>
  )
}
