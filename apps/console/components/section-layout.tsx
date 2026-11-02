import type { ReactNode } from "react"
import { Separator } from "@workspace/ui/components/separator"

// The shared frame of a page made of sections (Settings, Account): its title, then its menu (a SectionNav) beside the
// section on wide screens and above it on narrow ones. Layouts aren't re-run on client navigation, so each section's
// page guards itself.
export default function SectionLayout({ title, description, nav, children }: { title: string; description: string; nav: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-48 lg:shrink-0">{nav}</aside>
        <div className="min-w-0 flex-1 lg:max-w-3xl">{children}</div>
      </div>
    </div>
  )
}
