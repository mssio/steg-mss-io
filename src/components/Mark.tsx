import { cn } from '@/lib/utils'

/**
 * Placeholder mark until the real logo lands (Task 10): a 3×3 grid of
 * pixels, one lit in safelight amber. It is the "block" the message hides in.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <rect
        x="0.75"
        y="0.75"
        width="18.5"
        height="18.5"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => {
          const lit = row === 1 && col === 2
          return (
            <rect
              key={`${row}-${col}`}
              x={4.5 + col * 4}
              y={4.5 + row * 4}
              width="3"
              height="3"
              rx="0.6"
              className={lit ? 'fill-primary' : 'fill-current'}
              fillOpacity={lit ? 1 : 0.6}
            />
          )
        }),
      )}
    </svg>
  )
}
