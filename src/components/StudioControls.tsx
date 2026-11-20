import type { ReactNode } from 'react'
import { ArrowRightIcon, LoaderCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A numbered field in a studio panel: `01  Message`. */
export function Step({
  n,
  label,
  htmlFor,
  aside,
  children,
}: {
  n: string
  label: string
  htmlFor?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="flex items-baseline gap-3 text-sm font-medium">
          <span aria-hidden="true" className="readout text-primary">
            {n}
          </span>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  )
}

/** The studio's primary action; rendered in the panel on desktop and in the sticky bar below `lg`. */
export function PrimaryAction({
  label,
  workingLabel,
  disabled,
  working,
  onClick,
  className,
}: {
  label: string
  workingLabel: string
  disabled: boolean
  working: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary px-5 text-[0.9375rem] font-medium text-primary-foreground transition-[background-color,opacity,transform] duration-200',
        'hover:bg-primary/90 active:translate-y-px',
        // Solid, not translucent: in the sticky bar it sits over content.
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        className,
      )}
    >
      {working ? (
        <>
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:hidden" />
          {workingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRightIcon
            aria-hidden="true"
            strokeWidth={2}
            className="size-4 transition-transform duration-200 group-enabled:group-hover:translate-x-0.5"
          />
        </>
      )}
    </button>
  )
}
