import { EyeOffIcon, ScanEyeIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors duration-200',
    isActive
      ? 'bg-foreground text-background shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  )

/** Hide | Reveal as a segmented control. Route links; NavLink sets aria-current="page". */
export function ModeSwitch() {
  return (
    <nav aria-label="Mode" className="inline-flex rounded-full border border-border-strong bg-card/60 p-1">
      <NavLink to="/" end className={itemClass}>
        <EyeOffIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Hide
      </NavLink>
      <NavLink to="/reveal" className={itemClass}>
        <ScanEyeIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Reveal
      </NavLink>
    </nav>
  )
}
