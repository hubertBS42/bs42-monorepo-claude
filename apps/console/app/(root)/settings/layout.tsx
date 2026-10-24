import type { ReactNode } from "react"
import { Separator } from "@workspace/ui/components/separator"
import SettingsNav from "./_components/settings-nav"

// The settings sections' shared frame. Each page guards itself (layouts aren't re-run on client navigation).
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Storefront and console settings. Each card saves on its own.</p>
      </div>
      <Separator />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-48 lg:shrink-0">
          <SettingsNav />
        </aside>
        <div className="min-w-0 flex-1 lg:max-w-3xl">{children}</div>
      </div>
    </main>
  )
}
