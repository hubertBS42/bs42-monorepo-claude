import { Briefcase, Building2, FileText, LayoutDashboard, Settings, ShoppingBag, ShoppingCart, UsersIcon } from "lucide-react"
import type { NavItem } from "@/types"

/**
 * Menu presentation only: titles, icons, groups and order.
 * Who can see an entry is decided by routeAccess in lib/route-access.ts, matched by `url`,
 * so every url here needs a matching route (or a parent route) in routeAccess.
 */
export const navConfig: NavItem[] = [
  {
    url: "/",
    title: "Dashboard",
    icon: LayoutDashboard,
    group: "main",
    order: 1,
  },
  {
    url: "/catalogue",
    title: "Catalogue",
    icon: ShoppingBag,
    group: "main",
    order: 2,
    items: [
      { title: "Products", url: "/catalogue/products" },
      { title: "Categories", url: "/catalogue/categories" },
      { title: "Brands", url: "/catalogue/brands" },
      { title: "Reviews", url: "/catalogue/reviews" },
    ],
  },
  {
    url: "/store",
    title: "Store",
    icon: Building2,
    group: "main",
    order: 2,
    items: [
      { title: "Listings", url: "/store/listings" },
      { title: "Orders", url: "/store/orders" },
      { title: "Purchase Orders", url: "/store/purchase-orders" },
      { title: "Suppliers", url: "/store/suppliers" },
      { title: "Members", url: "/store/members" },
      { title: "Invitations", url: "/store/invitations" },
    ],
  },
  {
    url: "/stores",
    title: "Stores",
    icon: Building2,
    group: "main",
    order: 3,
  },
  {
    url: "/users",
    title: "Users",
    icon: UsersIcon,
    group: "main",
    order: 4,
  },
  {
    url: "/orders",
    title: "Orders",
    icon: ShoppingCart,
    group: "main",
    order: 5,
  },
  {
    url: "/quotes",
    title: "Quotes",
    icon: FileText,
    group: "main",
    order: 6,
  },
  {
    url: "/trade-accounts",
    title: "Trade Accounts",
    icon: Briefcase,
    group: "main",
    order: 7,
  },
  {
    url: "/settings",
    title: "Settings",
    icon: Settings,
    group: "secondary",
    order: 1,
  },
]
