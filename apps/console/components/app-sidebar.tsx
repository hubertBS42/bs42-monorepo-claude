"use client"

import * as React from "react"

import { Nav } from "@/components/nav"
import { NavUser } from "@/components/nav-user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@workspace/ui/components/sidebar"

import { StoreSwitcher } from "./store-switcher"

export function AppSidebar({ storefrontUrl, ...props }: React.ComponentProps<typeof Sidebar> & { storefrontUrl: string }) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <Nav />
      </SidebarContent>
      <SidebarFooter>
        <NavUser storefrontUrl={storefrontUrl} />
      </SidebarFooter>
    </Sidebar>
  )
}
