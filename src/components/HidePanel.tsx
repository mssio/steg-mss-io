import type { ReactNode } from 'react'
import { CapacityMeter } from '@/components/CapacityMeter'
import { PasswordField } from '@/components/PasswordField'
import { PrimaryAction, Step } from '@/components/StudioControls'
import type { CapacityDetail } from '@/lib/steg-types'
import { cn } from '@/lib/utils'

/** The primary action; rendered in the panel on desktop and in the sticky bar below `lg`. */
export function HideButton(props: { disabled: boolean; working: boolean; onClick: () => void; className?: string }) {
  return <PrimaryAction label="Hide message" workingLabel="Hiding…" {...props} />
}

export interface HidePanelProps {
  message: string
  onMessage: (value: string) => void
  password: string
  onPassword: (value: string) => void
  capacity: CapacityDetail | null
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
          disabled={working}
          rows={5}
          placeholder="Write the message to hide…"
          aria-describedby="hide-message-meter"
          className="block min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed transition-colors placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/15"
        />
        <div id="hide-message-meter">
          <CapacityMeter message={message} capacity={capacity} pending={measuring} />
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
