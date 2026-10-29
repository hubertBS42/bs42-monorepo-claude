"use client"

import type { ReactNode } from "react"
import { useShellSession } from "@/components/shell-data"
import { WorkspaceSwitchOverlay } from "@/components/workspace-switch-overlay"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { cn } from "@workspace/ui/lib/utils"
import { useStoreSwitcher } from "@/hooks/use-store-switcher"

// A link from a store's workspace to a page of the global one (the catalogue): it switches the active workspace to
// the platform first, since route access ties each page to a workspace. The active workspace belongs to the session,
// so other tabs move too, which the title says. Only system admins can open global pages; others get the text alone,
// or nothing with hideWithoutAccess (for a link that is only a way there, like "View in catalogue").
export default function GlobalWorkspaceLink({ href, className, hideWithoutAccess, children }: { href: string; className?: string; hideWithoutAccess?: boolean; children: ReactNode }) {
  const { user } = useShellSession()
  const { switchStore, isSwitching, switchingTo } = useStoreSwitcher()

  if (!hasSystemRole(user?.role, consoleAdminRoles)) return hideWithoutAccess ? null : <span className={className}>{children}</span>

  // The overlay beside the link, not inside it: React bubbles a click on it through the portal to the link's onClick
  return (
    <>
      <a
        href={href}
        title="Opens in the platform workspace"
        aria-disabled={isSwitching || undefined}
        className={cn("underline-offset-4 hover:text-foreground hover:underline", isSwitching && "pointer-events-none opacity-60", className)}
        onClick={(event) => {
          // A plain href would land in the store's workspace, where route access sends global pages away
          event.preventDefault()
          void switchStore({ storeSlug: PLATFORM_ORGANIZATION_SLUG, to: href, name: "Global" })
        }}
      >
        {children}
      </a>
      {switchingTo && <WorkspaceSwitchOverlay name={switchingTo} />}
    </>
  )
}
