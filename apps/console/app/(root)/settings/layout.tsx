import type { ReactNode } from "react"
import SectionLayout from "@/components/section-layout"
import SettingsNav from "./_components/settings-nav"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SectionLayout title="Platform Settings" description="Storefront and console settings. Each card saves on its own." nav={<SettingsNav />}>
      {children}
    </SectionLayout>
  )
}
