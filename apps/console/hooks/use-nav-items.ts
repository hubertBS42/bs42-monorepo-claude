import { NavItem } from "@/types"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { routePermissions } from "@/lib/access-control"
import { hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@/constants"

const getNavItems = (role: string | null | undefined, isGlobalWorkspace: boolean): Record<string, NavItem[]> => {
  const currentContext = isGlobalWorkspace ? "global" : "store"

  return (
    Object.entries(routePermissions)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, permission]) => {
        if (!permission.nav) return false
        const hasRole = hasSystemRole(role, permission.role)
        const hasContext = permission.context.includes(currentContext)
        return hasRole && hasContext
      })
      .map(([url, permission]) => {
        const filteredSubItems = permission.nav?.items?.filter(
          (item) => !item.context || item.context.includes(currentContext)
        )

        return {
          url,
          ...permission.nav!,
          items: filteredSubItems?.length ? filteredSubItems : undefined,
        }
      })
      .sort((a, b) => a.order - b.order)
      .reduce(
        (acc, item) => {
          if (!acc[item.group]) acc[item.group] = []
          acc[item.group]?.push(item)
          return acc
        },
        {} as Record<string, NavItem[]>
      )
  )
}

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

  if (isLoading) {
    return {
      navItems: {},
      isGlobalWorkspace: false,
      isAdmin: false,
      isLoading: true,
    }
  }

  if (!session || !activeOrganization) {
    return {
      navItems: {},
      isGlobalWorkspace: false,
      isAdmin: false,
      isLoading: false,
    }
  }

  const role = session.user.role
  const isGlobalWorkspace = activeOrganization.slug === PLATFORM_ORGANIZATION_SLUG
  const isAdmin = hasSystemRole(role, ["admin", "superAdmin"])
  const navItems = getNavItems(role, isGlobalWorkspace)

  return {
    navItems,
    isGlobalWorkspace,
    isAdmin,
    isLoading: false,
  }
}
