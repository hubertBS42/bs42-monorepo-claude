"use client"

import { createPortal } from "react-dom"
import { Spinner } from "@workspace/ui/components/spinner"

// Covers the console from the click until the switched workspace's page replaces it: the sidebar briefly follows the
// new workspace before the page reloads, which would otherwise flicker. Only rendered while switching, in the browser.
export function WorkspaceSwitchOverlay({ name }: { name: string }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm" aria-live="polite">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-5 py-4 shadow-lg">
        <Spinner className="size-5" />
        <p className="text-sm font-medium">Switching to {name}…</p>
      </div>
    </div>,
    document.body
  )
}
