import type { ReactNode } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { PasswordField } from '@/components/PasswordField'
import { PrimaryAction, Step } from '@/components/StudioControls'

/** The primary action; rendered in the panel on desktop and in the sticky bar below `lg`. */
export function RevealButton(props: { disabled: boolean; working: boolean; onClick: () => void; className?: string }) {
  return <PrimaryAction label="Reveal" workingLabel="Revealing…" {...props} />
}

/** Password and the Reveal action; the message card goes in `children`. */
export function RevealPanel({
  password,
  onPassword,
  blocker,
  working,
  error,
  quiet = false,
  onReveal,
  children,
}: {
  password: string
  onPassword: (value: string) => void
  /** Why the button is disabled (shown under it), or null when ready. */
  blocker: string | null
  working: boolean
  /** The core's error, shown as-is. */
  error: string | null
  /** Don't prompt for the next step (a message is already showing). */
  quiet?: boolean
  onReveal: () => void
  children?: ReactNode
}) {
  return (
    <section aria-label="Reveal a message" className="min-w-0 space-y-8 lg:pt-1">
      <Step n="01" label="Password" htmlFor="reveal-password">
        <PasswordField
          id="reveal-password"
          value={password}
          onChange={onPassword}
          disabled={working}
          generator={false}
          onEnter={blocker === null && !working ? onReveal : undefined}
        />
      </Step>

      <div className="space-y-3">
        <RevealButton disabled={blocker !== null || working} working={working} onClick={onReveal} className="max-lg:hidden" />
        <div className="min-h-5 text-sm">
          <div role="status" aria-live="polite">
            {working ? (
              <p className="text-primary">Deriving key…</p>
            ) : error ? (
              <div className="animate-in fade-in-0 flex gap-3 rounded-lg border border-destructive/35 bg-destructive/[0.06] px-4 py-3 duration-200">
                <CircleAlertIcon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="leading-relaxed">{error}</p>
              </div>
            ) : null}
          </div>
          {!working && !error && !quiet && blocker ? <p className="text-muted-foreground">{blocker}</p> : null}
        </div>
      </div>

      {children}
    </section>
  )
}
