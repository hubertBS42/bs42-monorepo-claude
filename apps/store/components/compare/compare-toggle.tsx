"use client"

import { useRouter } from "next/navigation"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { addComparePick, compareHref, removeComparePick, restartCompare, useComparePicks, type ComparePick } from "@/components/compare/compare-state"
import { MAX_COMPARE } from "@/lib/compare"

// The "Compare" checkbox on a card or the product page. A full list disables the others; a product from another
// category offers to start a new comparison, as only one category's products share specs. `onHover` (the cards') hides
// it until the card is hovered or focused, unless it's ticked; devices without a mouse always show it.
export function CompareToggle({ pick, onHover = false, className }: { pick: ComparePick; onHover?: boolean; className?: string }) {
  const router = useRouter()
  const picks = useComparePicks()
  const checked = picks.some((existing) => existing.id === pick.id)
  const full = !checked && picks.length >= MAX_COMPARE && picks[0]?.categoryId === pick.categoryId

  const change = (next: boolean) => {
    if (!next) {
      removeComparePick(pick.id)
      return
    }
    const result = addComparePick(pick)
    if (result === "other-category") {
      toast.add({
        title: "Compare holds one category at a time",
        description: "Products from different categories don't share specs.",
        actionProps: { children: "Start a new comparison", onClick: () => restartCompare(pick) },
      })
    } else if (result === "full") {
      toast.add({
        title: `You can compare up to ${MAX_COMPARE} products`,
        description: "Remove one to add another.",
        actionProps: { children: "Compare", onClick: () => router.push(compareHref(picks.map((existing) => existing.id))) },
      })
    }
  }

  return (
    <label
      className={cn(
        "flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground has-disabled:cursor-not-allowed",
        onHover && !checked && "transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100",
        className
      )}
      title={full ? `You can compare up to ${MAX_COMPARE} products` : undefined}
    >
      <Checkbox checked={checked} onCheckedChange={change} disabled={full} />
      Compare
    </label>
  )
}
