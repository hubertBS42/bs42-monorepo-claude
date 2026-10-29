import { consoleAuthClient } from "@workspace/auth/console-client"
import { useState } from "react"
import { toast } from "@workspace/ui/components/toast"

// to: the page to open once switched, the dashboard by default; name: the workspace's, for the overlay while switching
type SwitchByIdParams = { storeId: string; storeSlug?: never; to?: string; name?: string }
type SwitchBySlugParams = { storeSlug: string; storeId?: never; to?: string; name?: string }
type SwitchParams = SwitchByIdParams | SwitchBySlugParams

interface UseStoreSwitcherReturn {
  switchStore: (params: SwitchParams) => Promise<void>
  isSwitching: boolean
  // The workspace being switched to, while switching
  switchingTo: string | null
}

export function useStoreSwitcher(): UseStoreSwitcherReturn {
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const switchStore = async (params: SwitchParams) => {
    try {
      setIsSwitching(true)
      setSwitchingTo(params.name ?? "the workspace")
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
      setSwitchingTo(null)
    }
  }

  return {
    switchStore,
    isSwitching,
    switchingTo,
  }
}
