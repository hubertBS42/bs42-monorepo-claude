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
import { consoleAuthClient } from "@workspace/auth/console-client"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@/constants"
import { getNameInitials } from "@workspace/utils/name"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import Link from "next/link"

export const StoreSwitcherSkeleton = () => {
  return <Skeleton className="h-12 w-full rounded-lg" />
}

export function StoreSwitcher() {
  const { isMobile } = useSidebar()
  const { switchStore, isSwitching } = useStoreSwitcher()
  const { data: stores, isPending: isStoresLoading, error: storesError } = consoleAuthClient.useListOrganizations()
  const { data: session, isPending: isSessionLoading, error: sessionError } = consoleAuthClient.useSession()

  const isLoading = isStoresLoading || isSessionLoading

  if (isLoading || isSwitching) return <StoreSwitcherSkeleton />

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

  if (!session) return null

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

  const organizations = stores ?? []
  const isAdmin = hasSystemRole(session.user.role, consoleAdminRoles)
  const activeStore = organizations.find((store) => store.id === session.session.activeOrganizationId)
  const globalOrganization = organizations.find((store) => store.slug === PLATFORM_ORGANIZATION_SLUG)
  const clientStores = organizations.filter((store) => store.slug !== PLATFORM_ORGANIZATION_SLUG).sort((a, b) => a.name.localeCompare(b.name))
  const activeStoreName = activeStore?.name ?? (session.session.activeOrganizationId ? "Workspace unavailable" : "Select a workspace")
  const activeStoreType = activeStore ? (activeStore.slug === PLATFORM_ORGANIZATION_SLUG ? "Administrator" : "Store") : "No active workspace"

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
              <DropdownMenuCheckboxItem
                className="gap-2 px-1 py-1.5 text-sm"
                onClick={() =>
                  void switchStore({
                    storeSlug: PLATFORM_ORGANIZATION_SLUG,
                  })
                }
                checked={activeStore?.id === globalOrganization.id}
              >
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
              <DropdownMenuCheckboxItem
                key={store.id}
                className="gap-2 px-1 py-1.5 text-sm"
                onClick={() => void switchStore({ storeId: store.id })}
                checked={store.id === activeStore?.id}
              >
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
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
