import Link from "next/link"
import { Banknote, Mail, MapPin, Phone, ShieldCheck, Smartphone, Truck } from "lucide-react"
import type { AppSettingsData } from "@workspace/contracts"
import { formatPhoneNumber } from "@workspace/utils/phone"

import { MastercardIcon, VisaIcon, WhatsAppIcon } from "@/components/brand-icons"
import type { LegalLinks } from "@/components/legal-consent"
import { StoreLogo } from "@/components/store-logo"
import type { MenuItem } from "@/lib/menu"

const promises = [
  { icon: Truck, label: "Delivery across Ghana" },
  { icon: Smartphone, label: "Pay with Mobile Money or card" },
  { icon: Banknote, label: "Prices in cedis at today's rate" },
  { icon: ShieldCheck, label: "Secure checkout" },
]

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
    <footer className="mt-16 bg-muted print:hidden">
      <div className="border-b">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 lg:grid-cols-4 lg:px-6">
          {promises.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm font-medium">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_2fr_1.5fr] lg:px-6">
        <div className="space-y-3">
          <StoreLogo storeName={storeName} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} />
          {storeDescription && <p className="max-w-xs text-sm text-muted-foreground">{storeDescription}</p>}
        </div>
        <nav aria-label="Categories">
          <h2 className="mb-3 text-sm font-semibold">Shop</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            {menu.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {hasContact && <ContactList contact={contact} />}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-6 text-xs text-muted-foreground lg:px-6">
          <p>
            © {new Date().getFullYear()} {storeName}
          </p>
          <PaymentMethods />
          {/* The legal pages only once they've been written */}
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link href="/trade" className="hover:text-foreground hover:underline">
                Trade accounts
              </Link>
            </li>
            {legal.terms && (
              <li>
                <Link href="/terms" className="hover:text-foreground hover:underline">
                  Terms
                </Link>
              </li>
            )}
            {legal.privacy && (
              <li>
                <Link href="/privacy" className="hover:text-foreground hover:underline">
                  Privacy Policy
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  )
}

// The contact details from Settings, each only when it's set
function ContactList({ contact }: { contact: FooterContact }) {
  const linkClass = "flex items-start gap-2.5 hover:text-foreground hover:underline"
  const iconClass = "mt-0.5 size-4 shrink-0"

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Contact us</h2>
      <ul className="space-y-2.5 text-sm text-muted-foreground">
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
          <li className="flex items-start gap-2.5">
            <MapPin className={iconClass} aria-hidden />
            <address className="whitespace-pre-line not-italic">{contact.contactAddress}</address>
          </li>
        )}
      </ul>
    </div>
  )
}

// What Paystack's checkout takes (packages/commerce/src/paystack.ts asks it for mobile money and cards). Mobile money
// networks have no free marks, so they're named.
const MOBILE_MONEY = ["MTN MoMo", "Telecel Cash", "AT Money"]

function PaymentMethods() {
  const chip = "flex h-7 items-center rounded-md border bg-background px-2 text-foreground/75"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1">We accept</span>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li className={chip}>
          <VisaIcon className="h-6 w-8" />
        </li>
        <li className={chip}>
          <MastercardIcon className="h-5 w-7" />
        </li>
        {MOBILE_MONEY.map((name) => (
          <li key={name} className={`${chip} text-[11px] font-semibold`}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
