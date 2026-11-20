import { useState } from 'react'
import { DicesIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { toast } from 'sonner'
import { generatePassphrase, strength, type Strength } from '@/lib/passphrase'
import { cn } from '@/lib/utils'

const HINT: Record<Strength, { label: string; note: string; bars: number; tone: string }> = {
  weak: { label: 'Weak', note: 'Make it longer, or generate one.', bars: 1, tone: 'bg-destructive' },
  fair: { label: 'Fair', note: 'A few more words would help.', bars: 2, tone: 'bg-primary' },
  strong: { label: 'Strong', note: 'Keep it safe: it is the only key.', bars: 3, tone: 'bg-foreground/80' },
}

/** Password with show/hide, a simple strength hint, and a passphrase generator. */
export function PasswordField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const hint = value ? HINT[strength(value)] : null

  async function generate() {
    const phrase = generatePassphrase()
    onChange(phrase)
    setVisible(true)
    try {
      await navigator.clipboard.writeText(phrase)
      toast.success('Passphrase copied to the clipboard', {
        description: 'Keep it somewhere safe. You need it to reveal the message.',
      })
    } catch {
      toast('Passphrase generated', {
        description: 'Copy it now: the field clears after hiding.',
      })
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={`${id}-hint`}
            placeholder="Something only the recipient knows"
            className="h-11 w-full rounded-lg border border-input bg-transparent pr-11 pl-3 font-mono text-sm transition-colors outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-50 dark:bg-input/15"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-1 right-1 grid w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {visible ? (
              <EyeOffIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
            ) : (
              <EyeIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={disabled}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-3.5 text-sm transition-colors hover:border-foreground/40 hover:bg-muted disabled:opacity-50"
        >
          <DicesIcon aria-hidden="true" strokeWidth={1.75} className="size-4 text-primary" />
          Generate
        </button>
      </div>

      <div id={`${id}-hint`} className="flex min-h-4 items-center gap-2.5 text-xs text-muted-foreground">
        {hint ? (
          <>
            <span aria-hidden="true" className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn('h-1 w-5 rounded-full transition-colors duration-200', n <= hint.bars ? hint.tone : 'bg-muted')}
                />
              ))}
            </span>
            <span>
              <span className="text-foreground">{hint.label}.</span> {hint.note}
            </span>
          </>
        ) : (
          <span>Used exactly as typed. Generate one for six random words.</span>
        )}
      </div>
    </div>
  )
}
