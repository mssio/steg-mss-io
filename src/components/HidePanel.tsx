import type { ReactNode } from 'react'
import { ArrowRightIcon, LoaderCircleIcon } from 'lucide-react'
import { CapacityMeter } from '@/components/CapacityMeter'
import { PasswordField } from '@/components/PasswordField'
import { cn } from '@/lib/utils'

function Step({
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

/** The primary action; rendered in the panel on desktop and in the sticky bar below `lg`. */
export function HideButton({
  disabled,
  working,
  onClick,
  className,
}: {
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
      aria-disabled={disabled}
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
          Hiding…
        </>
      ) : (
        <>
          Hide message
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

export interface HidePanelProps {
  message: string
  onMessage: (value: string) => void
  password: string
  onPassword: (value: string) => void
  chars: number
  bytes: number
  capacity: number | null
  measuring: boolean
  /** Why the button is disabled (shown under it), or null when ready. */
  blocker: string | null
  working: boolean
  status: { tone: 'info' | 'error' | 'success'; text: string } | null
  onHide: () => void
  children?: ReactNode
}

/** Message, password and the Hide action. */
export function HidePanel({
  message,
  onMessage,
  password,
  onPassword,
  chars,
  bytes,
  capacity,
  measuring,
  blocker,
  working,
  status,
  onHide,
  children,
}: HidePanelProps) {
  return (
    <section aria-label="Hide a message" className="min-w-0 space-y-8 lg:pt-1">
      <Step n="01" label="Message" htmlFor="hide-message">
        <textarea
          id="hide-message"
          value={message}
          onChange={(e) => onMessage(e.currentTarget.value)}
          rows={5}
          placeholder="Write the message to hide…"
          aria-describedby="hide-message-meter"
          className="block min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring dark:bg-input/15"
        />
        <div id="hide-message-meter">
          <CapacityMeter chars={chars} bytes={bytes} max={capacity} pending={measuring} />
        </div>
      </Step>

      <Step n="02" label="Password" htmlFor="hide-password">
        <PasswordField id="hide-password" value={password} onChange={onPassword} />
      </Step>

      <div className="space-y-3">
        <HideButton
          disabled={blocker !== null || working}
          working={working}
          onClick={onHide}
          className="max-lg:hidden"
        />
        <div className="min-h-5 text-sm">
          <p
            role="status"
            aria-live="polite"
            className={cn(
              status?.tone === 'error' && 'text-destructive',
              status?.tone === 'success' && 'text-foreground',
              status?.tone === 'info' && 'text-primary',
            )}
          >
            {status?.text}
          </p>
          {!status && blocker ? <p className="text-muted-foreground">{blocker}</p> : null}
        </div>
      </div>

      {children}
    </section>
  )
}
