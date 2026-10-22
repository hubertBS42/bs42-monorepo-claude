"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Lock, ShoppingBasket, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { setBasketCount } from "@/components/basket/basket-count"
import { quoteToBasketAction } from "@/lib/actions/cart.actions"
import { acceptQuoteAction, cancelQuoteAction } from "@/lib/actions/quote.actions"

// Codes meaning the quote changed under the page (accepted, cancelled or lapsed meanwhile): show it as it is now
const REFRESH_ON = ["NOT_OPEN", "EXPIRED", "UNAVAILABLE"]

// Places the order at the quote's prices, then Paystack
export function AcceptQuoteButton({ quoteId, label }: { quoteId: string; label: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const accept = () =>
    startTransition(async () => {
      const result = await acceptQuoteAction(quoteId)
      if (result.success) {
        window.location.assign(result.data.redirectTo)
        return
      }
      toast.add({ title: "Your order wasn't placed", description: result.error, type: "error" })
      if (result.code && REFRESH_ON.includes(result.code)) router.refresh()
    })

  return (
    <Button type="button" size="lg" onClick={accept} disabled={isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" aria-hidden />}
      {label}
    </Button>
  )
}

export function CancelQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelQuoteAction(quoteId)
      if (!result.success) toast.add({ title: "Couldn't cancel the quotation", description: result.error, type: "error" })
      else toast.add({ title: "Quotation cancelled", type: "success" })
      router.refresh()
    })

  return (
    <Button type="button" variant="ghost" onClick={cancel} disabled={isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <X data-icon="inline-start" aria-hidden />}
      Cancel quotation
    </Button>
  )
}

// A lapsed (or partly unavailable) quote's items, in the basket at today's prices
export function QuoteToBasketButton({ quoteId, quoteKey }: { quoteId: string; quoteKey: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const fill = () =>
    startTransition(async () => {
      const result = await quoteToBasketAction(quoteId, quoteKey)
      if (!result.success) {
        toast.add({ title: "Couldn't fill your basket", description: result.error, type: "error" })
        return
      }
      setBasketCount(result.data.count)
      if (result.data.missed.length) {
        toast.add({ title: "Some items aren't available", description: `${result.data.missed.join(", ")} couldn't go in your basket.`, type: "warning" })
      }
      router.push("/basket")
    })

  return (
    <Button type="button" variant="outline" onClick={fill} disabled={isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <ShoppingBasket data-icon="inline-start" aria-hidden />}
      Put these items in your basket
    </Button>
  )
}
