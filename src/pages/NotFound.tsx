import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <title>Not found · steg.mss.io</title>
      <PageHeader eyebrow="404 · Frame not found" title="This frame came out blank.">
        <p>There is nothing at this address. The studio is one step back.</p>
      </PageHeader>
      <Button asChild size="lg" className="mt-10 h-10 rounded-full px-5">
        <Link to="/">
          <ArrowLeftIcon aria-hidden="true" />
          Back to the studio
        </Link>
      </Button>
    </div>
  )
}
