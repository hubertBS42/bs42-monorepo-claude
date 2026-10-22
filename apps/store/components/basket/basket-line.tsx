"use client"

import { useOptimistic, useTransition } from "react"
import Link from "next/link"
import { Package, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/components/toast"

import { setBasketCount } from "@/components/basket/basket-count"
import { QuantityStepper } from "@/components/basket/quantity-stepper"
import { removeFromBasketAction, setBasketInstallationAction, setBasketQuantityAction } from "@/lib/actions/cart.actions"
import type { CartLine } from "@/lib/cart"
import { formatGhs } from "@/lib/money"

export function BasketLine({ line }: { line: CartLine }) {
  const [isPending, startTransition] = useTransition()
  const [quantity, setOptimisticQuantity] = useOptimistic(line.quantity)
  const [withInstallation, setOptimisticInstallation] = useOptimistic(line.withInstallation)
  const href = `/p/${line.productSlug}${line.variantId ? `?variant=${line.variantId}` : ""}`

  const change = (next: number) =>
    startTransition(async () => {
      setOptimisticQuantity(next)
      const result = next === 0 ? await removeFromBasketAction(line.id) : await setBasketQuantityAction(line.id, next)
      if (!result.success) {
        toast.add({ title: "Couldn't update your basket", description: result.error, type: "error" })
        return
      }
      setBasketCount(result.data.count)
    })

  const changeInstallation = (next: boolean) =>
    startTransition(async () => {
      setOptimisticInstallation(next)
      const result = await setBasketInstallationAction(line.id, next)
      if (!result.success) toast.add({ title: "Couldn't update your basket", description: result.error, type: "error" })
    })

  return (
    <li className="flex gap-4 py-5">
      <Link href={href} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted sm:size-24">
        {line.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={line.image} alt="" className="size-full object-contain p-2" />
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
          {line.unitGhs && <p className="text-sm text-muted-foreground tabular-nums">{formatGhs(line.unitGhs)} each</p>}
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
          <div className="flex items-center gap-1">
            <QuantityStepper value={quantity} max={line.maxQuantity} onChange={change} disabled={isPending} label={`Quantity of ${line.productName}`} />
            <Button type="button" variant="ghost" size="icon" onClick={() => change(0)} disabled={isPending} aria-label={`Remove ${line.productName}`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
