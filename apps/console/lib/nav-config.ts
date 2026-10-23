import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mail,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Users,
  UsersIcon,
  PackagePlus,
} from "lucide-react"
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
      { title: "Product Requests", url: "/catalogue/product-requests" },
    ],
  },
  // A store's workspace: each page is its own item, in the order staff use them. Never shown with the global
  // workspace's items (routeAccess ties each to its workspace), so their orders can overlap.
  { url: "/store/orders", title: "Orders", icon: ShoppingCart, group: "main", order: 2 },
  { url: "/store/listings", title: "Listings", icon: Tag, group: "main", order: 3 },
  { url: "/store/product-requests", title: "Product Requests", icon: PackagePlus, group: "main", order: 4 },
  { url: "/store/purchase-orders", title: "Purchase Orders", icon: ClipboardList, group: "main", order: 5 },
  { url: "/store/transfers", title: "Transfers", icon: ArrowLeftRight, group: "main", order: 6 },
  { url: "/store/suppliers", title: "Suppliers", icon: Truck, group: "main", order: 7 },
  { url: "/store/members", title: "Members", icon: Users, group: "main", order: 8 },
  { url: "/store/invitations", title: "Invitations", icon: Mail, group: "main", order: 9 },
  // The store's own details, with Leave and Delete: occasional, so at the bottom like the platform's Settings
  { url: "/store", title: "Store Details", icon: Store, group: "secondary", order: 1, exact: true },
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
    url: "/purchase-orders",
    title: "Purchase Orders",
    icon: ClipboardList,
    group: "main",
    order: 6,
  },
  {
    url: "/quotes",
    title: "Quotes",
    icon: FileText,
    group: "main",
    order: 7,
  },
  {
    url: "/trade-accounts",
    title: "Trade Accounts",
    icon: Briefcase,
    group: "main",
    order: 8,
  },
  {
    url: "/settings",
    title: "Settings",
    icon: Settings,
    group: "secondary",
    order: 1,
  },
]
