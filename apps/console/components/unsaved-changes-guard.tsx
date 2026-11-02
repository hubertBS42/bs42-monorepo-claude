"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

// Warns before leaving a page form with unsaved changes (SharedFormFooter renders it, so every page form has it).
// - Closing or reloading the tab, or a full page load: the browser's own prompt (beforeunload; browsers show their
//   own words).
// - A click on a link to another console page (sidebar, breadcrumbs, links inside the form): our dialog. Next has no
//   global navigation guard, only Link's per-link onNavigate, so a capture listener on the document stops the click
//   before Link sees it. Leaving replays the click, so whatever the link does (a client navigation, a full page load
//   switching workspace) happens as before.
// Not covered: the browser's back and forward buttons, which Next handles without an event that can be cancelled.
// Uploads made on the page and left behind are removed by the orphaned-file sweep.
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const router = useRouter()
  const [target, setTarget] = useState<{ anchor: HTMLAnchorElement; href: string } | null>(null)
  // Set once the user chooses to leave, so the replayed click and the page unloading aren't stopped again
  const leaving = useRef(false)

  useEffect(() => {
    if (!when) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return
      event.preventDefault()
      // Older browsers need returnValue set to show the prompt
      event.returnValue = ""
    }

    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return
      // A modified click opens a new tab or window, which leaves this page alone
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return
      const url = new URL(anchor.href, window.location.href)
      // Another site is a full page load, which beforeunload already covers; a link to this page or a part of it
      // doesn't leave
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      setTarget({ anchor, href: `${url.pathname}${url.search}${url.hash}` })
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when])

  const leave = () => {
    if (!target) return
    leaving.current = true
    setTarget(null)
    // A link in a menu may have closed with it; a link no longer on the page can't be clicked
    if (target.anchor.isConnected) target.anchor.click()
    else router.push(target.href)
  }

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>Your changes on this page will be lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={leave}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
