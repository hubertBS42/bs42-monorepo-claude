"use client"

import { useEffect, useState } from "react"
import Autoplay from "embla-carousel-autoplay"
import { Banknote, ShieldCheck, Smartphone, Truck } from "lucide-react"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@workspace/ui/components/carousel"

const promises = [
  { icon: Truck, label: "Delivery across Ghana" },
  { icon: Smartphone, label: "Pay with Mobile Money or card" },
  { icon: Banknote, label: "Prices in cedis at today's rate" },
  { icon: ShieldCheck, label: "Secure checkout" },
]

// How long each promise shows before the next, on narrower screens
const SLIDE_SECONDS = 4

// The thin band of the brand colour above the footer, as on the old bs42.net: the promises in one centred row on wide
// screens, and below that a carousel showing one to three at a time that plays on its own (not for visitors who ask for
// reduced motion)
export function PromiseStrip() {
  const [api, setApi] = useState<CarouselApi>()
  // Created once: a new plugin on each render would restart the carousel. It starts stopped; the effect below plays it.
  const [autoplay] = useState(() => Autoplay({ delay: SLIDE_SECONDS * 1000, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true }))

  useEffect(() => {
    if (api && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) autoplay.play()
  }, [api, autoplay])

  return (
    <div className="bg-primary text-primary-foreground">
      <ul className="mx-auto hidden max-w-7xl items-center justify-center gap-x-[6vw] px-6 py-3 lg:flex">
        {promises.map((promise) => (
          <li key={promise.label}>
            <PromiseItem {...promise} />
          </li>
        ))}
      </ul>
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }} plugins={[autoplay]} aria-label="Why shop with us" className="py-3 lg:hidden">
        <CarouselContent className="ml-0">
          {promises.map((promise) => (
            <CarouselItem key={promise.label} className="flex basis-full justify-center pl-0 sm:basis-1/2 md:basis-1/3">
              <PromiseItem {...promise} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}

function PromiseItem({ icon: Icon, label }: (typeof promises)[number]) {
  return (
    <span className="flex items-center gap-1.5 font-(family-name:--font-display) font-bold whitespace-nowrap uppercase">
      <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      {label}
    </span>
  )
}
