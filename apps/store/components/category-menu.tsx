"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@workspace/ui/components/navigation-menu"
import { cn } from "@workspace/ui/lib/utils"

import type { MenuItem } from "@/lib/menu"

// The top categories in Rajdhani capitals, as on the old bs42.net
const topLevelClassName = "font-(family-name:--font-display) text-base font-semibold uppercase"

// The header's mega-menu, centred as on the old bs42.net: each top category opens its subcategories and theirs
export function CategoryMenu({ items }: { items: MenuItem[] }) {
  return (
    <NavigationMenu className="max-w-none justify-center">
      <NavigationMenuList className="justify-center">
        {items.map((item) =>
          item.children.length ? (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuTrigger className={cn("h-11 rounded-none bg-transparent", topLevelClassName)}>{item.name}</NavigationMenuTrigger>
              <NavigationMenuContent className="p-0">
                <div className="grid w-[min(48rem,calc(100vw-2rem))] grid-cols-2 gap-x-6 gap-y-4 p-5 md:grid-cols-3">
                  {item.children.map((child) => (
                    <div key={child.href} className="flex flex-col">
                      <NavigationMenuLink render={<Link href={child.href} />} className="px-2 py-1.5 font-semibold">
                        {child.name}
                      </NavigationMenuLink>
                      {child.children.map((grandchild) => (
                        <NavigationMenuLink key={grandchild.href} render={<Link href={grandchild.href} />} className="px-2 py-1 text-muted-foreground hover:text-foreground">
                          {grandchild.name}
                        </NavigationMenuLink>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="border-t bg-muted/50 px-5 py-3">
                  <NavigationMenuLink render={<Link href={item.href} />} className="inline-flex w-fit px-2 py-1 font-semibold">
                    Shop all {item.name}
                    <ArrowRight />
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink render={<Link href={item.href} />} className={cn(navigationMenuTriggerStyle(), "h-11 rounded-none bg-transparent", topLevelClassName)}>
                {item.name}
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
