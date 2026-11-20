import type { ReactNode } from 'react'

/** The eyebrow / serif headline / lede block that opens every page. */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="max-w-3xl">
      <p className="readout text-primary">{eyebrow}</p>
      <h1 className="mt-5 font-display text-display">{title}</h1>
      {children ? (
        <div className="mt-6 max-w-[54ch] text-base text-muted-foreground sm:text-lg sm:leading-relaxed">
          {children}
        </div>
      ) : null}
    </header>
  )
}
