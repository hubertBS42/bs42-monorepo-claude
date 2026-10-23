"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const SECTIONS = [
  { href: "/settings", title: "General" },
  { href: "/settings/pricing", title: "Pricing" },
  { href: "/settings/delivery", title: "Delivery" },
  { href: "/settings/notifications", title: "Notifications" },
  { href: "/settings/legal", title: "Legal" },
]

// The settings sections, after shadcn's forms example: a column beside the page on wide screens, a row above it on
// narrow ones
export default function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col" aria-label="Settings">
      {SECTIONS.map((section) => {
        const isActive = pathname === section.href
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(buttonVariants({ variant: "ghost" }), "justify-start", isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline")}
          >
            {section.title}
          </Link>
        )
      })}
    </nav>
  )
}
