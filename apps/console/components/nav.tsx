"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import { useNavItems } from "@/hooks/use-nav-items"
import type { NavItem, NavSubItem } from "@/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { usePathname } from "next/navigation"
import QuickCreateButton from "./quick-create-button"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function NavMainSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * Controlled collapsible that starts open when its branch is active and
 * opens again whenever the user navigates into it. It never forces itself
 * closed, so manual toggling still works.
 *
 * Must stay defined at module level (not inside Nav), otherwise it would be
 * re-created on every render and lose its open state.
 */
function ActiveCollapsible({ active, render, children }: { active: boolean; render: ReactElement; children: ReactNode }) {
  const [open, setOpen] = useState(active)
  const [prevActive, setPrevActive] = useState(active)

  // Adjust state during render when `active` changes, instead of in an effect
  if (active !== prevActive) {
    setPrevActive(active)
    if (active) setOpen(true)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={render}>
      {children}
    </Collapsible>
  )
}

export function Nav() {
  const { setOpenMobile } = useSidebar()
  const pathname = usePathname()
  const { navItems, isGlobalWorkspace, isAdmin, isLoading } = useNavItems()

  const isActive = (url: string): boolean => {
    return pathname === url || (url !== "/" && pathname.startsWith(`${url}/`))
  }

  const hasActiveChild = (items?: NavSubItem[]): boolean => {
    if (!items) return false
    return items.some((item) => {
      if (isActive(item.url)) return true
      if (item.items) return hasActiveChild(item.items)
      return false
    })
  }

  const renderSubItem = (item: NavSubItem): ReactNode => {
    const itemIsActive = isActive(item.url)
    const branchIsActive = itemIsActive || hasActiveChild(item.items)

    if (!item.items?.length) {
      return (
        <SidebarMenuSubItem key={item.title}>
          <SidebarMenuSubButton
            render={
              <Link href={item.url} onClick={() => setOpenMobile(false)}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            }
            isActive={itemIsActive}
          />
        </SidebarMenuSubItem>
      )
    }

    return (
      <ActiveCollapsible key={item.title} render={<SidebarMenuSubItem />} active={branchIsActive}>
        <SidebarMenuSubButton
          render={
            <Link href={item.url} onClick={() => setOpenMobile(false)} className="flex w-full items-center justify-between">
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </Link>
          }
          isActive={branchIsActive}
        />
        <CollapsibleTrigger
          render={
            <SidebarMenuAction className="data-panel-open:rotate-90">
              <ChevronRight />
              <span className="sr-only">Toggle</span>
            </SidebarMenuAction>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub className="ml-4">{item.items.map(renderSubItem)}</SidebarMenuSub>
        </CollapsibleContent>
      </ActiveCollapsible>
    )
  }

  if (isLoading) return <NavMainSkeleton />

  const renderNavItem = (item: NavItem) => {
    const showAsCollapsible = item.items && !item.hideItems
    const itemIsActive = item.exact ? pathname === item.url : isActive(item.url) || hasActiveChild(item.items)

    return showAsCollapsible ? (
      <ActiveCollapsible key={item.title} render={<SidebarMenuItem />} active={itemIsActive}>
        <SidebarMenuButton
          render={
            <Link href={item.url} onClick={() => setOpenMobile(false)}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </Link>
          }
          tooltip={item.title}
          isActive={itemIsActive}
        />
        <CollapsibleTrigger
          render={
            <SidebarMenuAction className="data-panel-open:rotate-90">
              <ChevronRight />
              <span className="sr-only">Toggle</span>
            </SidebarMenuAction>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>{item.items?.map(renderSubItem)}</SidebarMenuSub>
        </CollapsibleContent>
      </ActiveCollapsible>
    ) : (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          tooltip={item.title}
          render={
            <Link href={item.url} onClick={() => setOpenMobile(false)}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </Link>
          }
          isActive={itemIsActive}
        />
      </SidebarMenuItem>
    )
  }

  return (
    <>
      {/* Main nav */}
      {navItems.main && (
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            {isAdmin && isGlobalWorkspace && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <QuickCreateButton />
                </SidebarMenuItem>
              </SidebarMenu>
            )}

            <SidebarMenu>{navItems.main?.map((item) => renderNavItem(item))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Secondary nav */}
      {navItems.secondary && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>{navItems.secondary.map((item) => renderNavItem(item))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  )
}
