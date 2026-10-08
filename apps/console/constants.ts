import { Status } from "@workspace/db/enums"
import { BreadcrumbConfig, StoreStatus } from "./types"
import { capitalizeWord } from "@workspace/utils/text"

export const BREADCRUMB_DATA: BreadcrumbConfig[] = [
  {
    pathname: "/",
    segments: [
      {
        text: "Dashboard",
        href: "/",
      },
    ],
  },
  {
    pathname: "/stores",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Stores", href: "#" },
    ],
  },
  {
    pathname: "/stores/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Stores", href: "/stores" },
      { text: "Add Store", href: "#" },
    ],
  },
  {
    pathname: "/stores/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Stores", href: "/stores" },
      { text: "Edit Store", href: "#" },
    ],
  },
  {
    pathname: "/catalogue",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/products",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Products", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/products/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Products", href: "/catalogue/products" },
      { text: "Add Product", href: "#" },
    ],
  },
  {
    pathname: "catalogue/products/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Products", href: "/catalogue/products" },
      { text: "Edit Product", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/categories",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Categories", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/categories/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Categories", href: "/catalogue/categories" },
      { text: "Add Category", href: "#" },
    ],
  },
  {
    pathname: "catalogue/categories/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Categories", href: "/catalogue/categories" },
      { text: "Edit Category", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/brands",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Brands", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/brands/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Brands", href: "/catalogue/brands" },
      { text: "Add Brand", href: "#" },
    ],
  },
  {
    pathname: "catalogue/brands/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Manage Brands", href: "/catalogue/brands" },
      { text: "Edit Brand", href: "#" },
    ],
  },
  {
    pathname: "/users",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Users", href: "#" },
    ],
  },
  {
    pathname: "/users/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Users", href: "/users" },
      { text: "Add User", href: "#" },
    ],
  },
  {
    pathname: "/users/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Users", href: "/users" },
      { text: "Edit User", href: "#" },
    ],
  },
  {
    pathname: "/orders",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Orders", href: "#" },
    ],
  },
  {
    pathname: "/members",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Members", href: "#" },
    ],
  },
  {
    pathname: "/members/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Manage Members", href: "/members" },
      { text: "Member Details", href: "#" },
    ],
  },
  {
    pathname: "/store",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "#" },
    ],
  },
  {
    pathname: "/store/listings",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Listings", href: "#" },
    ],
  },
  {
    pathname: "/store/listings/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Listings", href: "/store/listings" },
      { text: "Add Listing", href: "#" },
    ],
  },
  {
    pathname: "/store/listings/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Listings", href: "/store/listings" },
      { text: "Edit Listing", href: "#" },
    ],
  },
  {
    pathname: "/store/orders",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Orders", href: "#" },
    ],
  },
  {
    pathname: "/store/orders/create",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Orders", href: "/store/orders" },
      { text: "Create Order", href: "#" },
    ],
  },
  {
    pathname: "/store/orders/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Orders", href: "/store/orders" },
      { text: "Order Details", href: "#" },
    ],
  },
  {
    pathname: "/store/members",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Members", href: "#" },
    ],
  },
  {
    pathname: "/store/members/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Members", href: "/store/members" },
      { text: "Member Details", href: "#" },
    ],
  },
  {
    pathname: "/store/invitations",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store", href: "/store" },
      { text: "Manage Invitations", href: "#" },
    ],
  },
  {
    pathname: "/account",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account Overview", href: "#" },
    ],
  },
  {
    pathname: "/account/profile",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account Overview", href: "/account" },
      { text: "Profile Details", href: "#" },
    ],
  },
  {
    pathname: "/account/password",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account Overview", href: "/account" },
      { text: "Change Password", href: "#" },
    ],
  },
  {
    pathname: "/account/sessions",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account Overview", href: "/account" },
      { text: "Manage Sessions", href: "#" },
    ],
  },
  {
    pathname: "/logs",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Activity Logs", href: "#" },
    ],
  },
]

export const STORE_STATUS_OPTIONS = Object.values(StoreStatus).map((value) => ({
  label: capitalizeWord(value),
  value,
}))

export const BRAND_STATUS_OPTIONS = Object.values(Status).map((value) => ({
  label: capitalizeWord(value),
  value,
}))
