"use client"

import type { LucideIcon } from "lucide-react"
import { Building2, CirclePlusIcon, FileText, FolderTree, Package, ShoppingCart, Tags, UserRound } from "lucide-react"
import Link from "next/link"
import { Fragment } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLinkItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { SidebarMenuButton, useSidebar } from "@workspace/ui/components/sidebar"

type SystemPermission = Parameters<typeof hasSystemPermission>[1]

interface QuickCreateItem {
  label: string
  url: string
  icon: LucideIcon
  // The add page's own guard, so the menu never offers a page that would send the user to /forbidden
  permission: SystemPermission
}

// The global workspace's add pages: sales, then the catalogue, then stores and people
const quickCreateGroups: QuickCreateItem[][] = [
  [
    { label: "New order", url: "/orders/create", icon: ShoppingCart, permission: { order: ["create"] } },
    { label: "New quote", url: "/quotes/create", icon: FileText, permission: { order: ["create"] } },
  ],
  [
    { label: "New product", url: "/catalogue/products/add", icon: Package, permission: { product: ["create"] } },
    { label: "New category", url: "/catalogue/categories/add", icon: FolderTree, permission: { category: ["create"] } },
    { label: "New brand", url: "/catalogue/brands/add", icon: Tags, permission: { brand: ["create"] } },
  ],
  [
    { label: "New store", url: "/stores/add", icon: Building2, permission: { organization: ["create"] } },
    { label: "New user", url: "/users/add", icon: UserRound, permission: { user: ["create"] } },
  ],
]

const QuickCreateButton = () => {
  const { isMobile, setOpenMobile } = useSidebar()
  const { data: session } = consoleAuthClient.useSession()

  const groups = quickCreateGroups.map((items) => items.filter((item) => hasSystemPermission(session?.user.role, item.permission))).filter((items) => items.length > 0)
  if (groups.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            tooltip="Quick Create"
            className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
          >
            <CirclePlusIcon />
            <span>Quick Create</span>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="start" sideOffset={4}>
        {groups.map((items, index) => (
          <Fragment key={items[0]!.url}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {items.map((item) => (
                <DropdownMenuLinkItem key={item.url} render={<Link href={item.url} onClick={() => setOpenMobile(false)} />}>
                  <item.icon />
                  {item.label}
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default QuickCreateButton
