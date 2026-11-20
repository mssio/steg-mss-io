import { PageHeader } from '@/components/PageHeader'

// Placeholder: Task 8 writes the full page (diagram, platform table, limits).
export function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <title>How it works · steg.mss.io</title>
      <PageHeader eyebrow="How it works" title="Hidden in plain sight.">
        <p>
          A message is encrypted with your password, protected with error
          correction, then written into the photo as tiny brightness shifts
          across 8×8 pixel blocks. Everything happens on your device.
        </p>
      </PageHeader>

      <section aria-labelledby="hiw-steps" className="mt-16 border-t border-border pt-10">
        <h2 id="hiw-steps" className="font-display text-title">
          Four steps, all local
        </h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['01', 'Encrypt', 'AES-256-GCM with a key stretched from your password.'],
            ['02', 'Protect', 'Hamming codes and triple redundancy absorb JPEG noise.'],
            ['03', 'Scatter', 'Bits go to 8×8 blocks in a password-derived order.'],
            ['04', 'Embed', 'Each block nudges its centre against its edge.'],
          ].map(([n, t, d]) => (
            <li key={n} className="bg-background p-6">
              <p className="readout text-primary">{n}</p>
              <p className="mt-4 text-base font-medium">{t}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
