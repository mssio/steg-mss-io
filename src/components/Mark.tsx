import { cn } from '@/lib/utils'

/**
 * Brand mark (matches public/logo.svg): geometric eye/aperture whose iris is a
 * 3×3 grid of squares with a single safelight-amber catchlight square.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path
        d="M2 16A14.5 14.5 0 0 1 30 16A14.5 14.5 0 0 1 2 16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="9.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="19.5" y="9.5" width="3" height="3" rx="0.5" className="fill-primary" />
      <rect x="9.5" y="14.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14.5" y="14.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="19.5" y="14.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="19.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14.5" y="19.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="19.5" y="19.5" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  )
}
