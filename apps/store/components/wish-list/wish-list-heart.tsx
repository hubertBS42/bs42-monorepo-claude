"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { getWishListState, loadWishList, SAVE_PARAM, saveParamValue, setSaved, useWishList, wishListKey, type WishListItemKey } from "@/components/wish-list/wish-list-state"
import { removeFromWishListAction, saveToWishListAction } from "@/lib/actions/wish-list.actions"
import { signInHref } from "@/lib/auth-redirect"

// Saves an item to the wish list, or removes it. Signed out, it goes to sign in and the item is saved on the way back.
// `onChange` runs once the list has changed (the wish list page reloads itself).
export function useWishListToggle(item: WishListItemKey, label: string, onChange?: () => void) {
  const router = useRouter()
  const wishList = useWishList()
  const [isPending, startTransition] = useTransition()
  const key = wishListKey(item)
  const saved = !!wishList?.signedIn && wishList.keys.has(key)

  const toggle = () =>
    startTransition(async () => {
      await loadWishList()
      const current = getWishListState()
      if (!current?.signedIn) {
        const back = new URL(window.location.href)
        back.searchParams.set(SAVE_PARAM, saveParamValue(item))
        router.push(signInHref("/sign-in", `${back.pathname}${back.search}`))
        return
      }

      // At once, and back if it fails
      const wasSaved = current.keys.has(key)
      setSaved(key, !wasSaved)
      const result = wasSaved ? await removeFromWishListAction(item) : await saveToWishListAction(item)
      if (!result.success) {
        setSaved(key, wasSaved)
        toast.add({ title: wasSaved ? "Couldn't remove that from your wish list" : "Couldn't save that to your wish list", description: result.error, type: "error" })
        return
      }
      onChange?.()
      toast.add(
        wasSaved
          ? { title: "Removed from your wish list", description: label }
          : { title: "Saved to your wish list", description: label, type: "success", actionProps: { children: "View wish list", onClick: () => router.push("/account/wish-list") } }
      )
    })

  return { saved, isPending, toggle }
}

// A heart over a card's image, or a "Save" button beside the product page's "Add to basket"
export function WishListHeart({
  item,
  label,
  appearance = "icon",
  onChange,
  className,
}: {
  item: WishListItemKey
  label: string
  appearance?: "icon" | "button"
  onChange?: () => void
  className?: string
}) {
  const { saved, isPending, toggle } = useWishListToggle(item, label, onChange)
  const icon = <Heart className={cn(saved && "fill-current text-rose-500")} data-icon={appearance === "button" ? "inline-start" : undefined} aria-hidden />

  if (appearance === "button") {
    return (
      <Button type="button" variant="outline" size="lg" className={className} onClick={toggle} disabled={isPending} aria-pressed={saved}>
        {icon}
        {saved ? "Saved" : "Save"}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn("rounded-full bg-background/80 backdrop-blur", className)}
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from your wish list` : `Save ${label} to your wish list`}
    >
      {icon}
    </Button>
  )
}
