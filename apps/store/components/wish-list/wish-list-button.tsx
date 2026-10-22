"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { saveFromUrl, useWishList } from "@/components/wish-list/wish-list-state"

// The header's link to the wish list, with how many items it holds. It's on every page, so it also saves the item a
// signed-out visitor's heart asked for once they're back from signing in (?save=).
export function WishListButton({ className }: { className?: string }) {
  const router = useRouter()
  const wishList = useWishList()
  const count = wishList?.signedIn ? wishList.keys.size : 0

  useEffect(() => {
    saveFromUrl()
      .then((saved) => {
        if (saved) toast.add({ title: "Saved to your wish list", type: "success", actionProps: { children: "View wish list", onClick: () => router.push("/account/wish-list") } })
      })
      .catch((error: Error) => toast.add({ title: "Couldn't save that to your wish list", description: error.message, type: "error" }))
  }, [router])

  return (
    <Button
      render={<Link href="/account/wish-list" />}
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      aria-label={count ? `Wish list, ${count} ${count === 1 ? "item" : "items"}` : "Wish list"}
    >
      <Heart className="size-5" aria-hidden />
      {!!count && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold text-primary-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  )
}
