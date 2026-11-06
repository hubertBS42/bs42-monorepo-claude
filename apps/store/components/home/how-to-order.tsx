import { FileText, Handshake, ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { WhatsAppIcon } from "@/components/brand-icons"

// The homepage's "How to order", only while the storefront takes no payments (Settings' Online Payments): the basket has
// no checkout then, so this says up front that orders go through a quotation, or a call
export function HowToOrder({ quoteValidityDays, phone, whatsapp }: { quoteValidityDays: number; phone: string | null; whatsapp: string | null }) {
  const steps = [
    { icon: ShoppingBasket, title: "Fill your basket", text: "Add what you need, with installation where it's offered." },
    { icon: FileText, title: "Get a quote", text: `Sign in and ask for a quote from your basket. It's emailed to you, with prices held for ${quoteValidityDays} days.` },
    { icon: Handshake, title: "We place your order", text: "Contact us to go ahead. We confirm delivery with you, and you pay by bank transfer or Mobile Money." },
  ]

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8">
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="size-5" aria-hidden />
            </span>
            <div>
              {/* A heading, so it takes the storefront's heading font (display-font.css) */}
              <h3 className="font-semibold">
                <span className="text-muted-foreground">{index + 1}. </span>
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {(phone || whatsapp) && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-6">
          <p className="text-sm text-muted-foreground">Rather talk to someone?</p>
          {whatsapp && (
            // wa.me takes the international number as digits only
            <Button render={<a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" />} variant="outline" size="sm">
              <WhatsAppIcon className="size-4" aria-hidden />
              Chat on WhatsApp
            </Button>
          )}
          {phone && (
            <Button render={<a href={`tel:${phone}`} />} variant="outline" size="sm">
              Call us
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
