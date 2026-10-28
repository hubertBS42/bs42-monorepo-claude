import Link from "next/link"
import { Mail, MapPin, Phone } from "lucide-react"
import type { AppSettingsData } from "@workspace/contracts"
import { formatPhoneNumber } from "@workspace/utils/phone"

import { WhatsAppIcon } from "@/components/brand-icons"
import type { LegalLinks } from "@/components/legal-consent"
import { PromiseStrip } from "@/components/promise-strip"
import { StoreLogo } from "@/components/store-logo"
import type { MenuItem } from "@/lib/menu"

export type FooterContact = Pick<AppSettingsData, "contactPhone" | "contactWhatsapp" | "contactEmail" | "contactAddress">

export function SiteFooter({
  storeName,
  storeDescription,
  logoUrl,
  logoDarkUrl,
  contact,
  menu,
  legal,
}: {
  storeName: string
  storeDescription: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
  contact: FooterContact
  menu: MenuItem[]
  legal: LegalLinks
}) {
  const hasContact = Object.values(contact).some(Boolean)

  return (
    // Charcoal in both themes, as on the old bs42.net: `dark` gives what's inside the dark theme's colours (and the logo for
    // dark backgrounds), the promise strip above it keeps the brand colour
    <footer className="print:hidden">
      <PromiseStrip />
      <div className="dark bg-neutral-800 text-neutral-300">
        {contact.contactPhone && (
          <div className="border-b border-neutral-700 px-4 py-4 text-center">
            <p className="font-(family-name:--font-display) text-xl font-semibold text-white">
              Need help? Call our support team on{" "}
              <a href={`tel:${contact.contactPhone}`} className="whitespace-nowrap hover:underline">
                {formatPhoneNumber(contact.contactPhone)}
              </a>
            </p>
          </div>
        )}
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_2fr_1.5fr] lg:px-6">
          <div className="space-y-3">
            <StoreLogo storeName={storeName} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} className="text-white" />
            {storeDescription && <p className="max-w-xs text-xs">{storeDescription}</p>}
          </div>
          <nav aria-label="Categories">
            <h2 className={headingClass}>Shop</h2>
            <ul className="grid grid-cols-2 gap-2.5 text-xs">
              {menu.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {hasContact && <ContactList contact={contact} />}
        </div>
      </div>
      {/* Centred, as on the old bs42.net; the legal pages only once they've been written */}
      <div className="dark bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3 text-center text-xs lg:px-6">
          <p>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          {legal.terms && (
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          )}
          {legal.privacy && (
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
          )}
        </div>
      </div>
    </footer>
  )
}

// The footer's column headings: white Rajdhani capitals (display-font.css sets the font and case for every heading)
const headingClass = "mb-4 text-base font-semibold text-white"

// The contact details from Settings, each only when it's set
function ContactList({ contact }: { contact: FooterContact }) {
  const linkClass = "flex items-start gap-2 transition-colors hover:text-white"
  const iconClass = "mt-0.5 size-4 shrink-0"

  return (
    <div>
      <h2 className={headingClass}>Contact us</h2>
      <ul className="space-y-2.5 text-xs">
        {contact.contactPhone && (
          <li>
            <a href={`tel:${contact.contactPhone}`} className={linkClass}>
              <Phone className={iconClass} aria-hidden />
              {formatPhoneNumber(contact.contactPhone)}
            </a>
          </li>
        )}
        {contact.contactWhatsapp && (
          <li>
            {/* wa.me takes the international number as digits only */}
            <a href={`https://wa.me/${contact.contactWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <WhatsAppIcon className={iconClass} aria-hidden />
              WhatsApp {formatPhoneNumber(contact.contactWhatsapp)}
            </a>
          </li>
        )}
        {contact.contactEmail && (
          <li>
            <a href={`mailto:${contact.contactEmail}`} className={`${linkClass} break-all`}>
              <Mail className={iconClass} aria-hidden />
              {contact.contactEmail}
            </a>
          </li>
        )}
        {contact.contactAddress && (
          <li className="flex items-start gap-2">
            <MapPin className={iconClass} aria-hidden />
            <address className="whitespace-pre-line not-italic">{contact.contactAddress}</address>
          </li>
        )}
      </ul>
    </div>
  )
}
