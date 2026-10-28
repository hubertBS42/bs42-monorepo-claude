import Link from "next/link"
import { Mail, Phone } from "lucide-react"

import type { FooterContact } from "@/components/site-footer"
import { siteLinks } from "@/lib/site-links"

// The thin bar above the header, as on the old bs42.net: Settings' phone and email (each only when set) on the left, the
// site's own pages on the right. It scrolls away with the page, and phones don't show it (the phone menu has the links).
export function TopBar({ contact }: { contact: Pick<FooterContact, "contactPhone" | "contactEmail"> }) {
  return (
    <div className="hidden border-b bg-muted text-[13px] md:block print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 lg:px-6">
        <ul className="flex items-center gap-6">
          {contact.contactPhone && (
            <li>
              <a href={`tel:${contact.contactPhone}`} className="flex items-center gap-1.5 hover:text-primary">
                <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
                Call us now
              </a>
            </li>
          )}
          {contact.contactEmail && (
            <li>
              <a href={`mailto:${contact.contactEmail}`} className="flex items-center gap-1.5 hover:text-primary">
                <Mail className="size-3.5" strokeWidth={1.5} aria-hidden />
                {contact.contactEmail}
              </a>
            </li>
          )}
        </ul>
        <nav aria-label="Site">
          <ul className="flex items-center gap-6">
            {siteLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
