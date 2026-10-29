"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useStoreSwitcher } from "@/hooks/use-store-switcher"
import { useShellOrganizations, useShellSession } from "@/components/shell-data"
import { WorkspaceSwitchOverlay } from "@/components/workspace-switch-overlay"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { getNameInitials } from "@workspace/utils/name"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import Link from "next/link"

export const StoreSwitcherSkeleton = () => {
  return <Skeleton className="h-12 w-full rounded-lg" />
}

export function StoreSwitcher() {
  const { isMobile } = useSidebar()
  const { switchStore, switchingTo } = useStoreSwitcher()
  const { organizations: stores, isPending: isStoresLoading, error: storesError } = useShellOrganizations()
  const { user, activeOrganizationId, isPending: isSessionLoading, error: sessionError } = useShellSession()

  const isLoading = isStoresLoading || isSessionLoading
  // A session signed in on the storefront has no workspace. The proxy picks one on the next page request, but a tab
  // already open fetches the session without one: pick the same workspace here (the login form's choice).
  const needsWorkspace = !!user && !activeOrganizationId && stores.length > 0
  const pickedWorkspace = React.useRef(false)
  React.useEffect(() => {
    if (!needsWorkspace || pickedWorkspace.current) return
    pickedWorkspace.current = true
    const preferred = stores.find((store) => store.slug === PLATFORM_ORGANIZATION_SLUG) ?? stores[0]!
    void switchStore({ storeId: preferred.id, to: `${window.location.pathname}${window.location.search}` })
  }, [needsWorkspace, stores, switchStore])

  if (isLoading || needsWorkspace) return <StoreSwitcherSkeleton />

  if (sessionError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <p role="alert" className="px-2 text-xs text-destructive">
            Unable to load your account.
          </p>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user) return null

  if (storesError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <p role="alert" className="px-2 text-xs text-destructive">
            Unable to load your workspaces. Refresh to try again.
          </p>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const organizations = stores
  const isAdmin = hasSystemRole(user.role, consoleAdminRoles)
  const activeStore = organizations.find((store) => store.id === activeOrganizationId)
  const globalOrganization = organizations.find((store) => store.slug === PLATFORM_ORGANIZATION_SLUG)
  const clientStores = organizations.filter((store) => store.slug !== PLATFORM_ORGANIZATION_SLUG).sort((a, b) => a.name.localeCompare(b.name))
  const activeStoreName = activeStore?.name ?? (activeOrganizationId ? "Workspace unavailable" : "Select a workspace")
  const activeStoreType = activeStore ? (activeStore.slug === PLATFORM_ORGANIZATION_SLUG ? "Administrator" : "Store") : "No active workspace"
  // Picking the workspace already in use only closes the menu: switching reloads the page
  const switchTo = (storeId: string, name: string) => {
    if (storeId !== activeStore?.id) void switchStore({ storeId, name })
  }

  if (!organizations.length) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <p role="status" className="px-2 text-xs text-muted-foreground">
            No workspaces are available for your account.
          </p>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={activeStore?.logo ?? ""} alt={activeStoreName} />
                  <AvatarFallback className="rounded-lg">{getNameInitials(activeStoreName)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activeStoreName}</span>
                  <span className="truncate text-xs text-muted-foreground">{activeStoreType}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="min-w-90 rounded-lg" align="start" side={isMobile ? "bottom" : "right"} sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Stores</DropdownMenuLabel>
            </DropdownMenuGroup>

            {isAdmin && globalOrganization && (
              <DropdownMenuCheckboxItem className="gap-2 px-1 py-1.5 text-sm" onClick={() => switchTo(globalOrganization.id, "Global")} checked={activeStore?.id === globalOrganization.id}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={globalOrganization.logo ?? ""} alt="Global" />
                  <AvatarFallback className="rounded-lg">{getNameInitials("Global")}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{"Global"}</span>
                  <span className="truncate text-xs text-muted-foreground">Administrator</span>
                </div>
              </DropdownMenuCheckboxItem>
            )}

            {clientStores.map((store) => (
              <DropdownMenuCheckboxItem key={store.id} className="gap-2 px-1 py-1.5 text-sm" onClick={() => switchTo(store.id, store.name)} checked={store.id === activeStore?.id}>
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={store.logo || ""} alt={store.name} />
                  <AvatarFallback className="rounded-lg">{getNameInitials(store.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{store.name}</span>
                  <span className="truncate text-xs text-muted-foreground">Store</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2"
                  render={
                    <Link href={"/stores/add"}>
                      <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                        <Plus className="size-4" />
                      </div>
                      <div className="font-medium text-muted-foreground">Add Store</div>
                    </Link>
                  }
                />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {switchingTo && <WorkspaceSwitchOverlay name={switchingTo} />}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
