import { useMemo } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { navConfig } from "@/lib/nav-config"
import { canAccess, type RouteContext } from "@/lib/route-access"
import type { NavItem } from "@/types"

// The same canAccess the proxy uses, so the menu never shows a link the proxy would block
const getNavItems = (role: string | null | undefined, context: RouteContext): Record<string, NavItem[]> =>
  navConfig
    .filter((item) => canAccess(item.url, role, context))
    .map((item) => {
      const items = item.items?.filter((subItem) => canAccess(subItem.url, role, context))
      return { ...item, items: items?.length ? items : undefined }
    })
    .sort((a, b) => a.order - b.order)
    .reduce(
      (groups, item) => {
        ;(groups[item.group] ??= []).push(item)
        return groups
      },
      {} as Record<string, NavItem[]>
    )

interface UseNavItemsReturn {
  navItems: Record<string, NavItem[]>
  isGlobalWorkspace: boolean
  isAdmin: boolean
  isLoading: boolean
}

export const useNavItems = (): UseNavItemsReturn => {
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()
  const { data: activeOrganization, isPending: isActiveOrganizationLoading } = consoleAuthClient.useActiveOrganization()

  const isLoading = isSessionLoading || isActiveOrganizationLoading
  const isReady = !isLoading && !!session && !!activeOrganization

  const role = session?.user.role
  const isGlobalWorkspace = isReady && activeOrganization.slug === PLATFORM_ORGANIZATION_SLUG
  const isAdmin = isReady && hasSystemRole(role, ["admin", "superAdmin"])

  const navItems = useMemo(() => (isReady ? getNavItems(role, isGlobalWorkspace ? "global" : "store") : {}), [isReady, role, isGlobalWorkspace])

  return { navItems, isGlobalWorkspace, isAdmin, isLoading }
}
