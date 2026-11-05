import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { ListChecks, PhoneCall, PiggyBank } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion"
import { Button } from "@workspace/ui/components/button"

import { categoryHref, getCategoryTree } from "@/lib/data/categories"

// The old bs42.net's VoIP page, at its old address. Its words are written here, as they were on the old site: change
// them in this file.
export const metadata: Metadata = {
  title: "VoIP for business",
  description: "VoIP and intercom systems for businesses with one branch or many: UK and US numbers, call centre features and free calls between branches.",
  alternates: { canonical: "/voip" },
}

// "Shop VoIP" goes to this category while it has something on sale
const VOIP_CATEGORY_SLUG = "voip"

const BENEFITS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <PiggyBank />,
    title: "Save on calls",
    text: "Make calls over the internet, with UK and US landline numbers, from anywhere in the world at local rates.",
  },
  {
    icon: <PhoneCall />,
    title: "One phone system",
    text: "With intercom systems, staff call each other across branches and regions at no extra cost.",
  },
  {
    icon: <ListChecks />,
    title: "Everything a business needs",
    text: "Call forwarding, call recording, menus for callers, call centre features, voicemail and conference calls, working with video conferencing and instant messaging.",
  },
]

const FAQS = [
  {
    question: "What is VoIP?",
    answer: "VoIP (Voice over Internet Protocol) carries phone calls over a data network such as the internet. It turns your voice into a digital signal that travels over the internet.",
  },
  {
    question: "What are the advantages of VoIP?",
    answer: "Lower costs, calls from anywhere, numbers that move with you, room to grow, and much easier working from home for your staff.",
  },
  {
    question: "Can I keep my phone number?",
    answer: "Usually, yes: most providers let you bring the number you had with your old phone company. Some charge for it, and moving a number isn't instant: it can take a few days.",
  },
  {
    question: "Does VoIP work without the internet?",
    answer: "No. VoIP needs an internet connection to make and receive calls.",
  },
]

export default async function VoipPage() {
  const tree = await getCategoryTree()
  const voip = tree.bySlug.get(VOIP_CATEGORY_SLUG)
  const shopHref = voip ? categoryHref(tree, voip.id) : null

  return (
    <div className="pb-16">
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static file in public/ */}
        <img src="/images/voip/banner.jpg" alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <div className="mx-auto max-w-7xl px-4 py-20 text-white md:py-32 lg:px-6">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">Communicate without boundaries on VoIP</h1>
          <p className="mt-4 max-w-xl text-lg text-white/90">VoIP and intercom systems for businesses with one branch or many, designed to help your teams and customers reach each other.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {shopHref && (
              <Button render={<Link href={shopHref} />} size="lg">
                Shop VoIP
              </Button>
            )}
            <Button render={<Link href="/contact-us" />} size="lg" variant="outline" className="border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Get a free consultation
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <section className="grid gap-8 py-14 md:grid-cols-3" aria-label="Why VoIP">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-6" aria-hidden>
                {benefit.icon}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{benefit.title}</h2>
                <p className="mt-1 text-muted-foreground">{benefit.text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid items-center gap-8 rounded-2xl bg-primary px-6 py-10 text-primary-foreground md:grid-cols-2 md:px-12">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static file in public/ */}
          <img src="/images/voip/phones.png" alt="Desk phones, a conference phone and a mobile" loading="lazy" className="w-full" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Your call, anytime, anywhere</h2>
            <p className="mt-4 text-lg text-primary-foreground/90">
              Whether you need a simple intercom for a small office or a VoIP system for a company across several countries, we give expert advice and support after the sale.
            </p>
          </div>
        </section>

        <section className="grid items-center gap-8 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Everything you need in one place</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              We have years of experience installing, maintaining and troubleshooting these systems, at competitive prices with flexible plans. Contact us for a free consultation and a quote.
            </p>
            <Button render={<Link href="/contact-us" />} className="mt-6">
              Contact us
            </Button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a static file in public/ */}
          <img src="/images/voip/calling.jpg" alt="" loading="lazy" className="w-full rounded-2xl object-cover" />
        </section>

        <section className="mx-auto max-w-3xl" aria-labelledby="questions">
          <h2 id="questions" className="text-3xl font-bold tracking-tight">
            Questions and answers
          </h2>
          <Accordion defaultValue={[FAQS[0]!.question]} className="mt-6">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-base">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </div>
  )
}
