import { consoleAuthClient } from "@workspace/auth/console-client"
import { useState } from "react"
import { toast } from "@workspace/ui/components/toast"

// to: the page to open once switched, the dashboard by default
type SwitchByIdParams = { storeId: string; storeSlug?: never; to?: string }
type SwitchBySlugParams = { storeSlug: string; storeId?: never; to?: string }
type SwitchParams = SwitchByIdParams | SwitchBySlugParams

interface UseStoreSwitcherReturn {
  switchStore: (params: SwitchParams) => Promise<void>
  isSwitching: boolean
}

export function useStoreSwitcher(): UseStoreSwitcherReturn {
  const [isSwitching, setIsSwitching] = useState(false)

  const switchStore = async (params: SwitchParams) => {
    try {
      setIsSwitching(true)
      const result =
        "storeSlug" in params
          ? await consoleAuthClient.organization.setActive({
              organizationSlug: params.storeSlug,
            })
          : await consoleAuthClient.organization.setActive({
              organizationId: params.storeId,
            })

      if (result.error) {
        throw new Error(result.error.message)
      }

      // A full page load on purpose: the active store changes the shared (root) layout
      // (sidebar, nav, store switcher), which a client-side push would not re-render.
      window.location.href = params.to ?? "/"
    } catch (error) {
      console.error("Failed to switch console organization:", error)
      const message = error instanceof Error ? error.message : "An unknown error occurred"
      toast.add({
        type: "error",
        description: "Failed to switch store: " + message,
        priority: "high",
      })
      setIsSwitching(false)
    }
  }

  return {
    switchStore,
    isSwitching,
  }
}
