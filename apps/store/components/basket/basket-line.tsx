"use client"

import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Package, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { setBasketCount } from "@/components/basket/basket-count"
import { QuantityStepper } from "@/components/basket/quantity-stepper"
import { removeFromBasketAction, setBasketInstallationAction, setBasketQuantityAction } from "@/lib/actions/cart.actions"
import type { CartLine } from "@/lib/cart"
import { formatGhs } from "@/lib/money"

// How long the basket waits after a − or + click before saving, so several quick clicks make one save
const SAVE_DELAY_MS = 500

// exTax: a trade account's basket, whose amounts are before tax
export function BasketLine({ line, exTax = false }: { line: CartLine; exTax?: boolean }) {
  const [isPending, startTransition] = useTransition()
  // What the stepper shows: the clicked quantity until it's saved, then the basket's (lowered if stock ran short, back
  // where it was if the save failed)
  const [quantity, setQuantity] = useState(line.quantity)
  const [waiting, setWaiting] = useState(false)
  const unsaved = useRef<{ timer: number; quantity: number } | null>(null)
  const controls = useRef<HTMLDivElement>(null)
  const [withInstallation, setOptimisticInstallation] = useOptimistic(line.withInstallation)
  const href = `/p/${line.productSlug}${line.variantId ? `?variant=${line.variantId}` : ""}`

  if (!waiting && !isPending && quantity !== line.quantity) setQuantity(line.quantity)

  const cancelWait = () => {
    if (unsaved.current) window.clearTimeout(unsaved.current.timer)
    unsaved.current = null
    setWaiting(false)
  }

  const save = (next: number) => {
    cancelWait()
    startTransition(async () => {
      const result = next === 0 ? await removeFromBasketAction(line.id) : await setBasketQuantityAction(line.id, next)
      if (!result.success) {
        toast.add({ title: "Couldn't update your basket", description: result.error, type: "error" })
        return
      }
      setBasketCount(result.data.count)
    })
  }

  // A click waits for more; a typed number saves at once
  const change = (next: number, typed = false) => {
    setQuantity(next)
    if (typed) return save(next)
    if (unsaved.current) window.clearTimeout(unsaved.current.timer)
    unsaved.current = { timer: window.setTimeout(() => save(next), SAVE_DELAY_MS), quantity: next }
    setWaiting(true)
  }

  // Leaving the stepper (towards checkout, say) saves what's waiting straight away, so the next page sees it
  const flush = useEffectEvent((event?: Event) => {
    if (!unsaved.current) return
    if (event?.target instanceof Node && controls.current?.contains(event.target)) return
    save(unsaved.current.quantity)
  })
  useEffect(() => {
    if (!waiting) return
    const onHidden = () => document.visibilityState === "hidden" && flush()
    document.addEventListener("pointerdown", flush, true)
    document.addEventListener("focusin", flush, true)
    document.addEventListener("visibilitychange", onHidden)
    return () => {
      document.removeEventListener("pointerdown", flush, true)
      document.removeEventListener("focusin", flush, true)
      document.removeEventListener("visibilitychange", onHidden)
    }
  }, [waiting])

  const changeInstallation = (next: boolean) =>
    startTransition(async () => {
      setOptimisticInstallation(next)
      const result = await setBasketInstallationAction(line.id, next)
      if (!result.success) toast.add({ title: "Couldn't update your basket", description: result.error, type: "error" })
    })

  return (
    <li className="flex gap-4 py-5">
      <Link href={href} className={cn("flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:size-24", line.image ? "bg-white" : "bg-muted")}>
        {line.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={line.image} alt="" className="size-full object-contain p-1" />
        ) : (
          <Package className="size-8 text-muted-foreground/40" aria-hidden />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href={href} className="line-clamp-2 font-semibold hover:underline">
            {line.productName}
          </Link>
          {line.variantDescription && <p className="text-sm text-muted-foreground">{line.variantDescription}</p>}
          {line.unitGhs && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatGhs(line.unitGhs)} each{exTax && ", ex. tax"}
            </p>
          )}
          {line.installationUnitGhs && (
            <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-sm has-disabled:cursor-not-allowed">
              <Checkbox checked={withInstallation} onCheckedChange={changeInstallation} disabled={isPending} />
              <span>
                Installation, {formatGhs(line.installationUnitGhs)} per item
                {line.installationGhs && <span className="text-muted-foreground tabular-nums"> · {formatGhs(line.installationGhs)}</span>}
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          {line.totalGhs && <p className="order-last font-semibold tabular-nums sm:order-first">{formatGhs(line.totalGhs)}</p>}
          <div ref={controls} className="flex items-center gap-1">
            <QuantityStepper value={quantity} max={line.maxQuantity} onChange={change} label={`Quantity of ${line.productName}`} />
            <Button type="button" variant="ghost" size="icon" onClick={() => save(0)} disabled={isPending} aria-label={`Remove ${line.productName}`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
