"use client"

import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/password", label: "Password" },
  { href: "/account/sessions", label: "Sessions" },
  { href: "/account/notifications", label: "Notifications" },
]

const CatalogueNav = () => {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b">
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "-mb-px border-b-2 px-3 pb-3 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default CatalogueNav
