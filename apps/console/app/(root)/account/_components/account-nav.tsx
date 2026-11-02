"use client"

import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/password", label: "Password" },
  { href: "/account/sessions", label: "Sessions" },
  { href: "/account/notifications", label: "Notifications" },
]

// Scrolls sideways on narrow screens, where the tabs don't fit, starting with the current tab in view
const AccountNav = () => {
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
    <nav ref={navRef} aria-label="Account" className="relative overflow-x-auto">
      <div className="flex w-max min-w-full gap-1 border-b">
        {links.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default AccountNav
