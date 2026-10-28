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
            <Slide slide={slide} first={index === 0} active={index === selected} />
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

// White text on the image, darkened on the text's side; a slide without an image is a plain muted panel. Laid out as on
// the old bs42.net: the text near the top, left-aligned (centred on phones), and on the shown slide the title drops in,
// then the text slides in from the left and the button fades in. The animation restarts each time a slide is shown.
function Slide({ slide, first, active }: { slide: CategorySlide; first: boolean; active: boolean }) {
  // The delays set only the animation's (tw-animate's delay-* would hold the button's hover transition back too)
  const enter = active && "motion-safe:animate-in motion-safe:fill-mode-both motion-safe:animation-duration-1000"
  return (
    <div className={cn("relative h-[300px] overflow-hidden sm:h-[550px]", slide.image ? "bg-neutral-900 text-white" : "bg-muted")}>
      {slide.image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
          <img src={slide.image} alt="" loading={first ? "eager" : "lazy"} fetchPriority={first ? "high" : undefined} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/45 to-black/10" aria-hidden />
        </>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-4 pt-[50px] sm:pt-[100px] lg:px-6">
        <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
          <h2 className={cn("text-[2rem] leading-[1.3] font-bold capitalize sm:text-5xl", enter, active && "motion-safe:fade-in motion-safe:slide-in-from-top-16 sm:motion-safe:slide-in-from-top-24")}>
            {slide.name}
          </h2>
          {slide.description && (
            <p
              className={cn(
                "line-clamp-3 max-w-[500px] text-base leading-[1.55]",
                slide.image ? "text-white" : "text-muted-foreground",
                enter,
                active && "motion-safe:[--tw-animation-delay:1s] motion-safe:fade-in motion-safe:slide-in-from-left-8"
              )}
            >
              {slide.description}
            </p>
          )}
          <Button
            render={<Link href={slide.href} />}
            className={cn(
              "h-9 rounded-sm px-[18px] font-heading text-base font-bold transition-all duration-300 ease-in hover:bg-white hover:text-primary",
              enter,
              active && "motion-safe:[--tw-animation-delay:1s] motion-safe:fade-in"
            )}
          >
            Shop now
          </Button>
        </div>
      </div>
    </div>
  )
}
