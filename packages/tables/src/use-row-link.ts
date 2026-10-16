"use client"

import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"

// Clicks on these keep their own behaviour instead of opening the row
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='checkbox'], [role='button'], [role='menuitem']"

// Whether a row click should open the row: not on a control, not a text selection, and not from a portal
// (React bubbles events from portaled menus and dialogs through the row even though they aren't inside it)
function isPlainRowClick(event: MouseEvent<HTMLTableRowElement>) {
  const target = event.target as Element
  if (!event.currentTarget.contains(target)) return false
  if (target.closest(INTERACTIVE_SELECTOR)) return false
  return !window.getSelection()?.toString()
}

// Row handlers that make a click anywhere on the row behave like a click on its link
export function useRowLink() {
  const router = useRouter()

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, href: string) => {
    if (!isPlainRowClick(event)) return
    // Match what the same click on a link does
    if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, "_blank", "noopener")
    else router.push(href)
  }

  const handleRowAuxClick = (event: MouseEvent<HTMLTableRowElement>, href: string) => {
    // Middle click opens a new tab, as it would on a link
    if (event.button === 1 && isPlainRowClick(event)) window.open(href, "_blank", "noopener")
  }

  return { handleRowClick, handleRowAuxClick }
}
