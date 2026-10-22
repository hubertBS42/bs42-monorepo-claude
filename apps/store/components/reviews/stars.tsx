import { Star } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

// A rating out of 5 as five stars, the last one filled in part ("4.5" fills four and a half). Screen readers get the
// number instead.
export function Stars({ rating, className }: { rating: number | string; className?: string }) {
  const value = Math.min(5, Math.max(0, Number(rating)))
  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 5 stars`} className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.min(1, Math.max(0, value - index))
        return (
          <span key={index} className="relative inline-flex size-[1em]" aria-hidden>
            <Star className="size-full text-muted-foreground/30" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="size-[1em] max-w-none text-amber-500" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

// Stars with the count beside them, as cards and the product page's header show it
export function RatingLine({ rating, count, className }: { rating: string; count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <Stars rating={rating} />
      <span className="text-muted-foreground">
        {Number(rating).toFixed(1)} ({count === 1 ? "1 review" : `${count} reviews`})
      </span>
    </span>
  )
}
