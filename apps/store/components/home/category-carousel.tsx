"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Autoplay from "embla-carousel-autoplay"
import { Button } from "@workspace/ui/components/button"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel"
import { cn } from "@workspace/ui/lib/utils"

export interface CategorySlide {
  id: string
  name: string
  description: string | null
  image: string | null
  href: string
}

// How long each slide shows before the next
const SLIDE_SECONDS = 6

// The homepage's hero: a full-width slide per featured category, its image behind its name, description and a link to
// it. It plays on its own, pausing while the pointer or keyboard focus is on it, and not at all for visitors who ask
// for reduced motion.
export function CategoryCarousel({ slides }: { slides: CategorySlide[] }) {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)
  // Created once: a new plugin on each render would restart the carousel. It starts stopped; the effect below plays it.
  const [autoplay] = useState(() => Autoplay({ delay: SLIDE_SECONDS * 1000, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true }))
  const multiple = slides.length > 1

  useEffect(() => {
    if (!api) return
    const onSelect = () => setSelected(api.selectedScrollSnap())
    onSelect()
    api.on("select", onSelect).on("reInit", onSelect)
    if (multiple && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) autoplay.play()
    return () => {
      api.off("select", onSelect).off("reInit", onSelect)
    }
  }, [api, multiple, autoplay])

  return (
    <Carousel setApi={setApi} opts={{ loop: true }} plugins={multiple ? [autoplay] : []} aria-label="Featured categories">
      <CarouselContent className="ml-0">
        {slides.map((slide, index) => (
          <CarouselItem key={slide.id} className="pl-0" aria-label={`${index + 1} of ${slides.length}`}>
            <Slide slide={slide} first={index === 0} />
          </CarouselItem>
        ))}
      </CarouselContent>

      {multiple && (
        <>
          <CarouselPrevious variant="secondary" size="icon" className="left-4 hidden opacity-80 hover:opacity-100 md:inline-flex" />
          <CarouselNext variant="secondary" size="icon" className="right-4 hidden opacity-80 hover:opacity-100 md:inline-flex" />
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show ${slide.name}`}
                aria-current={index === selected}
                onClick={() => api?.scrollTo(index)}
                className={cn("h-2 rounded-full bg-white/50 shadow ring-1 ring-black/20 transition-all hover:bg-white/80", index === selected ? "w-6 bg-white" : "w-2")}
              />
            ))}
          </div>
        </>
      )}
    </Carousel>
  )
}

// White text on the image, darkened on the text's side; a slide without an image is a plain muted panel
function Slide({ slide, first }: { slide: CategorySlide; first: boolean }) {
  return (
    <div className={cn("relative flex h-80 items-center overflow-hidden sm:h-96 lg:h-[34rem]", slide.image ? "bg-neutral-900 text-white" : "bg-muted")}>
      {slide.image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
          <img src={slide.image} alt="" loading={first ? "eager" : "lazy"} fetchPriority={first ? "high" : undefined} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/45 to-black/10" aria-hidden />
        </>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-4 lg:px-6">
        <div className="flex max-w-xl flex-col items-start gap-4 md:px-10 lg:px-0">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">{slide.name}</h2>
          {slide.description && <p className={cn("line-clamp-3 text-base md:text-lg", slide.image ? "text-white/85" : "text-muted-foreground")}>{slide.description}</p>}
          <Button render={<Link href={slide.href} />} size="lg" className="mt-2">
            Shop now
          </Button>
        </div>
      </div>
    </div>
  )
}
