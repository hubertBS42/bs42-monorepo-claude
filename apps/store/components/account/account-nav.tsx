"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Heart, Mail, MapPin, MessageSquareText, Package } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export const ACCOUNT_LINKS = [
  { href: "/account/orders", label: "My orders", icon: Package },
  { href: "/account/wish-list", label: "Wish list", icon: Heart },
  { href: "/account/reviews", label: "Reviews", icon: MessageSquareText },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/email-preferences", label: "Email preferences", icon: Mail },
]

// The account pages' menu: a column beside the page, a row above it on phones
export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
