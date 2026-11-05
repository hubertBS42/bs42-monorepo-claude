import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { Clock, ExternalLink, Mail, MapPin, MessageSquareOff, Phone } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { formatPhoneNumber } from "@workspace/utils/phone"

import { WhatsAppIcon } from "@/components/brand-icons"
import { getAppSettings } from "@/lib/settings"

// At the old bs42.net's address, so links to it keep working
export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, message or visit us about a product, an order or an installation.",
  alternates: { canonical: "/contact-us" },
}

// Settings' contact details (General → Contact), each only when it's set
export default async function ContactPage() {
  const settings = await getAppSettings()
  const { contactPhone, contactPhone2, contactPhone2Label, contactWhatsapp, contactEmail, contactAddress, contactMapUrl, contactHours } = settings
  const hasDetails = [contactPhone, contactPhone2, contactWhatsapp, contactEmail, contactAddress, contactHours].some(Boolean)

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Contact us</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contact us</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Questions about a product, an order or an installation? We&apos;re happy to help.</p>
      </header>

      {hasDetails ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {(contactPhone || contactPhone2) && (
            <ContactCard icon={<Phone />} title="Call us">
              <ul className="space-y-1">
                {contactPhone && (
                  <li>
                    <a href={`tel:${contactPhone}`} className="font-medium hover:underline">
                      {formatPhoneNumber(contactPhone)}
                    </a>
                  </li>
                )}
                {contactPhone2 && (
                  <li>
                    <a href={`tel:${contactPhone2}`} className="font-medium hover:underline">
                      {formatPhoneNumber(contactPhone2)}
                    </a>
                    {contactPhone2Label && <span className="text-muted-foreground"> ({contactPhone2Label})</span>}
                  </li>
                )}
              </ul>
            </ContactCard>
          )}

          {contactWhatsapp && (
            <ContactCard icon={<WhatsAppIcon />} title="WhatsApp">
              <p className="text-muted-foreground">{formatPhoneNumber(contactWhatsapp)}</p>
              {/* wa.me takes the international number as digits only */}
              <Button render={<a href={`https://wa.me/${contactWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" />} size="sm" className="mt-3">
                Chat on WhatsApp
              </Button>
            </ContactCard>
          )}

          {contactEmail && (
            <ContactCard icon={<Mail />} title="Email">
              <a href={`mailto:${contactEmail}`} className="font-medium break-all hover:underline">
                {contactEmail}
              </a>
            </ContactCard>
          )}

          {contactAddress && (
            <ContactCard icon={<MapPin />} title="Visit us">
              <address className="whitespace-pre-line not-italic">{contactAddress}</address>
              {contactMapUrl && (
                <Button render={<a href={contactMapUrl} target="_blank" rel="noopener noreferrer" />} variant="outline" size="sm" className="mt-3">
                  Get directions
                  <ExternalLink data-icon="inline-end" aria-hidden />
                </Button>
              )}
            </ContactCard>
          )}

          {contactHours && (
            <ContactCard icon={<Clock />} title="Opening hours">
              <p className="whitespace-pre-line">{contactHours}</p>
            </ContactCard>
          )}
        </div>
      ) : (
        <EmptyState icon={MessageSquareOff} title="No contact details yet" description="They'll be here soon. You can still find an order by its reference." className="rounded-xl border">
          <Button render={<Link href="/orders/find" />} variant="outline" size="sm">
            Find an order
          </Button>
        </EmptyState>
      )}
    </div>
  )
}

function ContactCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4 rounded-xl border p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-5" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 text-sm">
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  )
}
