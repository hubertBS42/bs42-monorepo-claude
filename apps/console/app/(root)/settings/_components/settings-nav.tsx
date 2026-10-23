"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Coins, Scale, SlidersHorizontal, Truck } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

const SECTIONS = [
  { href: "/settings", title: "General", icon: SlidersHorizontal },
  { href: "/settings/pricing", title: "Pricing", icon: Coins },
  { href: "/settings/delivery", title: "Delivery", icon: Truck },
  { href: "/settings/notifications", title: "Notifications", icon: Bell },
  { href: "/settings/legal", title: "Legal", icon: Scale },
]

// The settings sections, styled like the storefront's account menu: a column beside the page on wide screens, a row
// above it on narrow ones
export default function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Settings" className="overflow-x-auto">
      <ul className="flex gap-1 lg:flex-col">
        {SECTIONS.map(({ href, title, icon: Icon }) => {
          // Exact, since every section's path starts with General's
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted font-medium text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
