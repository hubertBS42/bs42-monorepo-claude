import Link from "next/link"
import { Phone } from "lucide-react"
import { formatPhoneNumber } from "@workspace/utils/phone"

import { WhatsAppIcon } from "@/components/brand-icons"
import type { FooterContact } from "@/components/site-footer"
import { siteLinks } from "@/lib/site-links"

// The thin bar above the header, as on the old bs42.net: Settings' phone and WhatsApp (each only when set) on the left,
// the site's own pages on the right. It scrolls away with the page, and phones don't show it (the phone menu has the
// links). The number is written out: it's on wider screens, where a tel: link often can't call, so people dial it.
export function TopBar({ contact }: { contact: Pick<FooterContact, "contactPhone" | "contactWhatsapp"> }) {
  return (
    <div className="hidden border-b bg-muted text-[13px] md:block print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 lg:px-6">
        <ul className="flex items-center gap-6">
          {contact.contactPhone && (
            <li>
              <a href={`tel:${contact.contactPhone}`} className="flex items-center gap-1.5 hover:text-primary">
                <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
                {formatPhoneNumber(contact.contactPhone)}
              </a>
            </li>
          )}
          {contact.contactWhatsapp && (
            <li>
              {/* wa.me takes the international number as digits only: WhatsApp Web on a computer, the app on a tablet */}
              <a href={`https://wa.me/${contact.contactWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary">
                <WhatsAppIcon className="size-3.5" aria-hidden />
                Chat on WhatsApp
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
