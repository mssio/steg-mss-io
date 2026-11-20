import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { PipelineDiagram } from '@/components/PipelineDiagram'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    n: '01',
    title: 'Encrypt',
    body: 'Your password is stretched into a key (600,000 rounds of PBKDF2) and the message is sealed with AES-256-GCM. Without the password it is indistinguishable from noise, and any tampering is detected.',
  },
  {
    n: '02',
    title: 'Protect',
    body: 'Every four bits become a seven-bit Hamming codeword that can repair a flipped bit, and each codeword is written three times. That soaks up the small errors JPEG compression introduces.',
  },
  {
    n: '03',
    title: 'Scatter',
    body: 'The bits are spread across the photo’s 8×8 pixel blocks in an order only your password can reproduce, so there is no fixed place to look.',
  },
  {
    n: '04',
    title: 'Embed',
    body: 'In each chosen block, the centre is made a touch brighter or darker than its edge. At normal size the photo looks unchanged.',
  },
]

type Verdict = 'keeps' | 'depends' | 'breaks'

const VERDICT: Record<Verdict, { label: string; dot: string; text: string }> = {
  keeps: { label: 'Keeps it', dot: 'bg-foreground', text: 'text-foreground' },
  depends: { label: 'Only if not resized', dot: 'bg-primary', text: 'text-primary' },
  breaks: { label: 'Usually breaks it', dot: 'bg-destructive', text: 'text-destructive' },
}

const PLATFORMS: { how: string; note: string; verdict: Verdict; label?: string }[] = [
  {
    how: 'Sent as a file or document',
    note: 'WhatsApp, Telegram, email, AirDrop, a shared drive: the exact file arrives, pixels untouched.',
    verdict: 'keeps',
  },
  {
    how: 'Sent as a photo on WhatsApp, Telegram, Instagram or Facebook',
    note: 'These apps shrink and recompress photos to save data, which wipes out the pattern.',
    verdict: 'breaks',
  },
  {
    how: 'Posted on X / Twitter',
    note: 'Smaller images can go through as they are; larger ones get scaled down.',
    verdict: 'depends',
  },
  {
    how: 'A screenshot or a crop',
    note: 'The pixels are redrawn or shifted off the 8×8 grid, so the blocks no longer line up.',
    verdict: 'breaks',
    label: 'Always breaks it',
  },
]

const LIMITS = [
  {
    title: 'It hides and encrypts, but it isn’t invisible to an expert.',
    body: 'To a person, the photo looks ordinary. An analyst running statistical tests can tell that it was altered. They still can’t read the message without the password.',
  },
  {
    title: 'The password is the whole lock.',
    body: 'Security depends entirely on it. A short or guessable password can be tried over and over by anyone who has the photo. Use a long one, or generate six random words. There is no recovery if it’s lost.',
  },
  {
    title: 'Resizing destroys the message.',
    body: 'Scaling, cropping, screenshots and heavy filters wipe it out. The error correction is built for a round of JPEG recompression, not for a change in size.',
  },
]

function Section({
  id,
  index,
  title,
  children,
  className,
}: {
  id: string
  index: string
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'mt-16 grid scroll-mt-8 gap-6 border-t border-border pt-8 sm:mt-24 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12',
        className,
      )}
    >
      <div className="space-y-3">
        <p className="readout text-primary">{index}</p>
        <h2 id={`${id}-title`} className="font-display text-title">
          {title}
        </h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <title>How it works · steg.mss.io</title>
      <PageHeader eyebrow="How it works" title="Hidden in plain sight.">
        <p>
          A message is encrypted with your password, protected with error correction, then written into the
          photo as tiny brightness shifts across 8×8 pixel blocks. Everything happens on your device.
        </p>
      </PageHeader>

      <div className="crop-marks mt-12 rounded-xl border border-border bg-card/40 px-4 py-6 sm:mt-16 sm:px-8 sm:py-10">
        <PipelineDiagram />
      </div>

      <Section id="hiding" index="A · Hiding" title="Four steps, all local">
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {STEPS.map(({ n, title, body }) => (
            <li key={n} className="bg-background p-6">
              <p className="readout text-primary">{n}</p>
              <h3 className="mt-4 text-base font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="revealing" index="B · Revealing" title="The same steps, backwards">
        <div className="max-w-[60ch] space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            Reveal reads the blocks in your password’s order, takes a majority vote over the three copies, repairs
            what it can, then decrypts. If any byte is off, decryption refuses rather than show you garbage.
          </p>
          <p>
            A wrong password and a photo with no message look exactly the same, on purpose. Either way you’ll see{' '}
            <span className="text-foreground">“No message found, or the password is wrong.”</span>
          </p>
          <p>
            It all runs in your browser. Your photo, message and password never leave this device: there is no
            server to send them to.
          </p>
        </div>
      </Section>

      <Section id="sending" index="C · Sending" title="Where the message survives">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">How sending a photo affects the hidden message</caption>
            <thead className="bg-card">
              <tr className="readout text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-normal sm:px-5">
                  How it’s sent
                </th>
                <th scope="col" className="w-[38%] px-4 py-3 font-normal sm:w-[30%] sm:px-5">
                  Expected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {PLATFORMS.map(({ how, note, verdict, label }) => {
                const v = VERDICT[verdict]
                return (
                  <tr key={how} className="align-top">
                    <th scope="row" className="px-4 py-4 font-normal sm:px-5">
                      <span className="block font-medium text-foreground">{how}</span>
                      <span className="mt-1 block leading-relaxed text-muted-foreground">{note}</span>
                    </th>
                    <td className="px-4 py-4 sm:px-5">
                      <span className={cn('inline-flex items-start gap-2', v.text)}>
                        <span aria-hidden="true" className={cn('mt-[0.4375rem] size-1.5 shrink-0 rounded-full', v.dot)} />
                        {label ?? v.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          This is expected behaviour, not a tested guarantee: apps change how they handle images without notice. When
          it matters, send the photo as a file, and test once with the recipient.
        </p>
      </Section>

      <Section id="limits" index="D · Limits" title="What it can’t do">
        <ul className="space-y-8">
          {LIMITS.map(({ title, body }, i) => (
            <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
              <span aria-hidden="true" className="readout pt-1 text-muted-foreground">
                {`0${i + 1}`}
              </span>
              <div>
                <h3 className="text-base font-medium">{title}</h3>
                <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <Link
          to="/"
          className="mt-10 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Hide a message
        </Link>
      </Section>
    </div>
  )
}
