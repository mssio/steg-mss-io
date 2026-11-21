import type { ReactNode } from 'react'

/**
 * Below `lg`, the primary action stays reachable in a bar pinned to the bottom
 * of the viewport while the studio is on screen.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-5 mt-8 border-t border-border bg-background/85 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8 lg:hidden">
      {children}
    </div>
  )
}
