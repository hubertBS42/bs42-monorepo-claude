"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export type Section = { href: string; title: string; icon: LucideIcon }

// The menu of a page made of sections (Settings, Account), styled like the storefront's account menu: a column beside
// the page on wide screens, a row above it on narrow ones, which scrolls sideways when it doesn't fit, starting with the
// current section in view. Icons are components, so each menu is its own client component passing its sections in.
export default function SectionNav({ label, sections }: { label: string; sections: Section[] }) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    // Only the row scrolls (scrollIntoView could move the page too)
    const overflow = active.offsetLeft + active.offsetWidth - (nav.scrollLeft + nav.clientWidth)
    if (overflow > 0) nav.scrollLeft += overflow
    else if (active.offsetLeft < nav.scrollLeft) nav.scrollLeft = active.offsetLeft
  }, [pathname])

  return (
    <nav ref={navRef} aria-label={label} className="relative overflow-x-auto">
      <ul className="flex gap-1 lg:flex-col">
        {sections.map(({ href, title, icon: Icon }) => {
          // Exact, since a section's path can start with another's (/settings)
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
