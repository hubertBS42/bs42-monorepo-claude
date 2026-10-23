import { Condition, Status } from "@workspace/db/enums"
import { BreadcrumbConfig, StoreStatus, UserStatusFilter, type ListingStockState } from "./types"
import { capitalizeWord } from "@workspace/utils/text"

// Each page's trail, matched by pathname ([id] matches one segment). An href may hold the pathname's own [id], filled
// in from the URL. A page without an entry falls back to its sidebar section (AppHeader).
export const BREADCRUMB_DATA: BreadcrumbConfig[] = [
  { pathname: "/", segments: [{ text: "Dashboard", href: "/" }] },
  {
    pathname: "/stores",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Stores", href: "#" },
    ],
  },
  {
    pathname: "/stores/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Stores", href: "/stores" },
      { text: "Add Store", href: "#" },
    ],
  },
  {
    pathname: "/stores/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Stores", href: "/stores" },
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
      { text: "Products", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/products/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Products", href: "/catalogue/products" },
      { text: "Add Product", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/products/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Products", href: "/catalogue/products" },
      { text: "Edit Product", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/categories",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Categories", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/categories/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Categories", href: "/catalogue/categories" },
      { text: "Add Category", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/categories/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Categories", href: "/catalogue/categories" },
      { text: "Edit Category", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/brands",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Brands", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/brands/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Brands", href: "/catalogue/brands" },
      { text: "Add Brand", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/brands/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Brands", href: "/catalogue/brands" },
      { text: "Edit Brand", href: "#" },
    ],
  },
  {
    pathname: "/catalogue/reviews",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Catalogue", href: "/catalogue" },
      { text: "Reviews", href: "#" },
    ],
  },
  {
    pathname: "/users",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Users", href: "#" },
    ],
  },
  {
    pathname: "/users/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Users", href: "/users" },
      { text: "Add User", href: "#" },
    ],
  },
  {
    pathname: "/users/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Users", href: "/users" },
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
    pathname: "/orders/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Orders", href: "/orders" },
      { text: "Order Details", href: "#" },
    ],
  },
  {
    pathname: "/quotes",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Quotes", href: "#" },
    ],
  },
  {
    pathname: "/quotes/create",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Quotes", href: "/quotes" },
      { text: "New Quotation", href: "#" },
    ],
  },
  {
    pathname: "/quotes/[id]",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Quotes", href: "/quotes" },
      { text: "Quotation", href: "#" },
    ],
  },
  {
    pathname: "/trade-accounts",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Trade Accounts", href: "#" },
    ],
  },
  {
    pathname: "/trade-accounts/[id]",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Trade Accounts", href: "/trade-accounts" },
      { text: "Trade Account", href: "#" },
    ],
  },
  {
    pathname: "/settings",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Settings", href: "#" },
    ],
  },
  {
    pathname: "/settings/pricing",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Settings", href: "/settings" },
      { text: "Pricing", href: "#" },
    ],
  },
  {
    pathname: "/settings/delivery",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Settings", href: "/settings" },
      { text: "Delivery", href: "#" },
    ],
  },
  {
    pathname: "/settings/notifications",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Settings", href: "/settings" },
      { text: "Notifications", href: "#" },
    ],
  },
  {
    pathname: "/settings/legal",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Settings", href: "/settings" },
      { text: "Legal", href: "#" },
    ],
  },
  {
    pathname: "/store/orders",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Orders", href: "#" },
    ],
  },
  {
    pathname: "/store/orders/create",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Orders", href: "/store/orders" },
      { text: "Create Order", href: "#" },
    ],
  },
  {
    pathname: "/store/orders/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Orders", href: "/store/orders" },
      { text: "Order Details", href: "#" },
    ],
  },
  {
    pathname: "/store/listings",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Listings", href: "#" },
    ],
  },
  {
    pathname: "/store/listings/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Listings", href: "/store/listings" },
      { text: "Add Listing", href: "#" },
    ],
  },
  {
    pathname: "/store/listings/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Listings", href: "/store/listings" },
      { text: "Edit Listing", href: "#" },
    ],
  },
  {
    pathname: "/store/listings/[id]/stock-history",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Listings", href: "/store/listings" },
      { text: "Edit Listing", href: "/store/listings/[id]/edit" },
      { text: "Stock History", href: "#" },
    ],
  },
  {
    pathname: "/store/purchase-orders",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Purchase Orders", href: "#" },
    ],
  },
  {
    pathname: "/store/purchase-orders/create",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Purchase Orders", href: "/store/purchase-orders" },
      { text: "Create Purchase Order", href: "#" },
    ],
  },
  {
    pathname: "/store/purchase-orders/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Purchase Orders", href: "/store/purchase-orders" },
      { text: "Purchase Order", href: "#" },
    ],
  },
  {
    pathname: "/store/purchase-orders/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Purchase Orders", href: "/store/purchase-orders" },
      { text: "Purchase Order", href: "/store/purchase-orders/[id]/details" },
      { text: "Edit Purchase Order", href: "#" },
    ],
  },
  {
    pathname: "/store/suppliers",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Suppliers", href: "#" },
    ],
  },
  {
    pathname: "/store/suppliers/add",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Suppliers", href: "/store/suppliers" },
      { text: "Add Supplier", href: "#" },
    ],
  },
  {
    pathname: "/store/suppliers/[id]/edit",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Suppliers", href: "/store/suppliers" },
      { text: "Edit Supplier", href: "#" },
    ],
  },
  {
    pathname: "/store/members",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Members", href: "#" },
    ],
  },
  {
    pathname: "/store/members/[id]/details",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Members", href: "/store/members" },
      { text: "Member Details", href: "#" },
    ],
  },
  {
    pathname: "/store/invitations",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Invitations", href: "#" },
    ],
  },
  {
    pathname: "/store",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Store Details", href: "#" },
    ],
  },
  {
    pathname: "/account",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account", href: "#" },
    ],
  },
  {
    pathname: "/account/profile",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account", href: "/account" },
      { text: "Profile", href: "#" },
    ],
  },
  {
    pathname: "/account/password",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account", href: "/account" },
      { text: "Password", href: "#" },
    ],
  },
  {
    pathname: "/account/sessions",
    segments: [
      { text: "Dashboard", href: "/" },
      { text: "Account", href: "/account" },
      { text: "Sessions", href: "#" },
    ],
  },
]

export const STORE_STATUS_OPTIONS = Object.values(StoreStatus).map((value) => ({
  label: capitalizeWord(value),
  value,
}))

// Catalogue status (brands, categories)
export const STATUS_OPTIONS = Object.values(Status).map((value) => ({
  label: capitalizeWord(value),
  value,
}))

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: "New",
  REFURBISHED: "Refurbished",
  USED_LIKE_NEW: "Used – like new",
  USED_GOOD: "Used – good",
  USED_FAIR: "Used – fair",
}

export const CONDITION_OPTIONS = Object.values(Condition).map((value) => ({
  label: CONDITION_LABELS[value],
  value,
}))

export const USER_STATUS_FILTERS: readonly UserStatusFilter[] = ["active", "banned"]

// The listings table's stock filter, in the words of its stock badges
export const LISTING_STOCK_OPTIONS: { label: string; value: ListingStockState }[] = [
  { label: "In stock", value: "in" },
  { label: "Low stock", value: "low" },
  { label: "Out of stock", value: "out" },
  { label: "Not tracked", value: "untracked" },
]
