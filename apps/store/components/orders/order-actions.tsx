"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Lock, ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { setBasketCount } from "@/components/basket/basket-count"
import { reorderAction } from "@/lib/actions/cart.actions"
import { payOrderAction } from "@/lib/actions/checkout.actions"

// An unpaid order's way back to Paystack
export function PayNowButton({ orderId, orderKey, label }: { orderId: string; orderKey: string; label: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const pay = () =>
    startTransition(async () => {
      const result = await payOrderAction(orderId, orderKey)
      if (result.success) {
        window.location.assign(result.data.redirectTo)
        return
      }
      toast.add({ title: "Couldn't start the payment", description: result.error, type: "error" })
      if (result.code === "PAYMENT_CLOSED") router.refresh()
    })

  return (
    <Button type="button" size="lg" onClick={pay} disabled={isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" aria-hidden />}
      {label}
    </Button>
  )
}

// A cancelled order's items, back in the basket at today's prices
export function ReorderButton({ orderId, orderKey }: { orderId: string; orderKey: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const reorder = () =>
    startTransition(async () => {
      const result = await reorderAction(orderId, orderKey)
      if (!result.success) {
        toast.add({ title: "Couldn't fill your basket", description: result.error, type: "error" })
        return
      }
      setBasketCount(result.data.count)
      if (result.data.missed.length) {
        toast.add({ title: "Some items aren't available", description: `${result.data.missed.join(", ")} couldn't go back in your basket.`, type: "warning" })
      }
      router.push("/basket")
    })

  return (
    <Button type="button" variant="outline" onClick={reorder} disabled={isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <ShoppingBasket data-icon="inline-start" aria-hidden />}
      Put these items back in your basket
    </Button>
  )
}
