import { Building2, LayoutDashboard, LucideIcon, ShoppingBag, ShoppingCart, UsersIcon } from "lucide-react"
import { SystemRole } from "@workspace/auth/system-permissions"
import { NavSubItem } from "@/types"

interface RoutePermission {
  role: SystemRole[]
  context: ("global" | "store")[]
  nav?: {
    title: string
    icon: LucideIcon
    group: "main" | "secondary"
    order: number
    hideItems?: boolean
    items?: NavSubItem[]
  }
}

export const routePermissions: Record<string, RoutePermission> = {
  "/": {
    role: ["superAdmin", "admin", "user"],
    context: ["global", "store"],
    nav: {
      title: "Dashboard",
      icon: LayoutDashboard,
      group: "main",
      order: 1,
    },
  },
  "/catalogue": {
    role: ["superAdmin", "admin"],
    context: ["global"],
    nav: {
      title: "Catalogue",
      icon: ShoppingBag,
      group: "main",
      order: 2,
      items: [
        { title: "Products", url: "/catalogue/products", context: ["global"] },
        {
          title: "Categories",
          url: "/catalogue/categories",
          context: ["global"],
        },
        {
          title: "Brands",
          url: "/catalogue/brands",
          context: ["global"],
        },
      ],
    },
  },
  "/stores": {
    role: ["superAdmin", "admin"],
    context: ["global"],
    nav: {
      title: "Stores",
      icon: Building2,
      group: "main",
      order: 3,
    },
  },
  "/users": {
    role: ["superAdmin", "admin"],
    context: ["global"],
    nav: {
      title: "Users",
      icon: UsersIcon,
      group: "main",
      order: 4,
    },
  },
  "/orders": {
    role: ["superAdmin", "admin"],
    context: ["global"],
    nav: {
      title: "Orders",
      icon: ShoppingCart,
      group: "main",
      order: 5,
    },
  },
  // "/listings": {
  //   role: ["superAdmin", "admin", "user"],
  //   context: ["store"],
  //   nav: {
  //     title: "Listings",
  //     icon: ClipboardList,
  //     group: "main",
  //     order: 2,
  //   },
  // },

  "/store": {
    role: ["superAdmin", "admin", "user"],
    context: ["store"],
    nav: {
      title: "Store",
      icon: Building2,
      group: "main",
      order: 2,
      items: [
        {
          title: "Listings",
          url: "/store/listings",
          context: ["store"],
        },
        {
          title: "Orders",
          url: "/store/orders",
          context: ["store"],
        },
        {
          title: "Members",
          url: "/store/members",
          context: ["store"],
        },
        {
          title: "Invitations",
          url: "/store/invitations",
          context: ["store"],
        },
      ],
    },
  },
  "/account/profile": {
    role: ["superAdmin", "admin", "user"],
    context: ["global", "store"],
  },
  "/account/password": {
    role: ["superAdmin", "admin", "user"],
    context: ["global", "store"],
  },
}
