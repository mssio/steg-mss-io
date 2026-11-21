import { ShieldCheckIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** "Runs entirely in your browser" pill; the popover says how. Lives on the dark hero. */
export function PrivacyBadge() {
  return (
    <Popover>
      <PopoverTrigger className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 py-1.5 pr-3.5 pl-2.5 text-left text-[0.8125rem] leading-snug text-[var(--hero-fg)] backdrop-blur-sm transition-colors hover:border-[#ffb547]/60 data-[state=open]:border-[#ffb547]/60">
        <ShieldCheckIcon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-[#ffb547]" />
        <span>Runs entirely in your browser. Nothing is uploaded.</span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(22rem,calc(100vw-2.5rem))] gap-3 p-4">
        <p className="readout text-primary">On this device</p>
        <p className="text-sm leading-relaxed">
          The encryption and the hiding run in WebAssembly inside this page. Your photo, message and
          password are never sent anywhere: there is no server to send them to.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No cookies, no analytics. Once the page has loaded it even works offline.
        </p>
        <Link
          to="/how-it-works"
          className="self-start text-sm text-primary underline-offset-4 hover:underline"
        >
          How it works
        </Link>
      </PopoverContent>
    </Popover>
  )
}
