import { ArrowUpRightIcon } from 'lucide-react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { Mark } from '@/components/Mark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

export const SOURCE_URL = 'https://github.com/mssio/steg-mss-io'

const SPECS = ['AES-256-GCM', 'PBKDF2 600k', '8×8 blocks', 'Runs on this device']

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative rounded-md px-2.5 py-1.5 text-sm transition-colors',
    'text-muted-foreground hover:text-foreground',
    isActive &&
      'text-foreground after:absolute after:inset-x-2.5 after:-bottom-px after:h-px after:bg-primary',
  )

export function AppShell() {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      <div aria-hidden="true" className="safelight" />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            to="/"
            className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1"
            aria-label="steg.mss.io home"
          >
            <Mark className="size-[1.375rem]" />
            <span className="flex items-baseline">
              <span className="font-display text-[1.625rem] leading-none tracking-tight">
                steg
              </span>
              <span className="ml-px font-mono text-[0.8125rem] leading-none tracking-tight text-muted-foreground">
                .mss.io
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/how-it-works" className={navLinkClass}>
              How it works
            </NavLink>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border-strong" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-10">
          <div className="space-y-2.5">
            <p className="flex items-center gap-2.5 text-sm">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              No cookies, no analytics, no uploads.
            </p>
            <ul
              aria-label="Technical details"
              className="readout flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground sm:gap-x-2"
            >
              {SPECS.map((spec, i) => (
                <li key={spec} className="flex items-center gap-2">
                  {i > 0 ? (
                    <span aria-hidden="true" className="max-sm:hidden">
                      ·
                    </span>
                  ) : null}
                  {spec}
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="-mx-2.5 flex items-center gap-1">
            <Link
              to="/how-it-works"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </Link>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Source
              <ArrowUpRightIcon
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </footer>

      <Toaster position="bottom-center" />
      <ScrollRestoration />
      <div aria-hidden="true" className="grain" />
    </div>
  )
}
