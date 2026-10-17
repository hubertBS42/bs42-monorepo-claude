import { PaginationParams, PaginatedResult } from "@workspace/contracts"
import { Brand, Category, Organization, Prisma, User } from "@workspace/db/client"
import { Condition, DiscountType, OrderStatus, OrganizationStatus, PaymentMethod, PaymentStatus, ShippingMethod, Status } from "@workspace/db/enums"
import type { LucideIcon } from "lucide-react"
import type { z } from "zod"
import type { addProductFormSchema } from "@/lib/schemas/product.schemas"
import type { listingSnapshotSchema } from "@/lib/schemas/listing.schemas"
import type { SystemRole } from "@workspace/auth/system-permissions"
import type { OrgRole } from "@workspace/auth/organization-permissions"

// Minimal record shape for loaders that feed SelectField options
export interface SelectItem {
  id: string
  name: string
}

export interface BreadcrumbSegment {
  text: string
  href: string
}

export interface BreadcrumbConfig {
  pathname: string
  segments: BreadcrumbSegment[]
}

export interface NavSubItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: NavSubItem[]
}

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  group: "main" | "secondary"
  order: number
  hideItems?: boolean
  items?: NavSubItem[]
}

export const StoreStatus = OrganizationStatus
export type StoreStatus = OrganizationStatus

export type Store = Omit<Organization, "status"> & {
  status: StoreStatus
}

export type StoresData = PaginatedResult<Store>

export interface StoresParams extends PaginationParams {
  name?: string
  status?: StoreStatus
}

export type UsersData = PaginatedResult<User>

// "Banned" means a ban that hasn't expired yet (see isBanActive)
export type UserStatusFilter = "active" | "banned"

export interface UsersParams extends PaginationParams {
  name?: string
  email?: string
  role?: SystemRole
  status?: UserStatusFilter
}

export type UserDetails = Prisma.UserGetPayload<{
  include: {
    members: {
      include: {
        organization: true
      }
    }
    addresses: true
  }
}>

export interface StoreMembersParams extends PaginationParams {
  name?: string
  email?: string
  role?: OrgRole
}

// Any store member can see these pages, so only what they show: no phone, date of birth or ban reason
export type StoreMember = Prisma.MemberGetPayload<{
  include: {
    user: { select: { name: true; email: true; image: true; emailVerified: true; banned: true; banExpires: true } }
  }
}>

export type StoreMembersData = PaginatedResult<StoreMember>

export interface InvitationsParams extends PaginationParams {
  email?: string
  role?: OrgRole
}

// The inviter is only named in the table, so only their name and email are loaded
export type InvitationForTable = Prisma.InvitationGetPayload<{
  include: {
    inviter: { select: { name: true; email: true } }
  }
}>

export type InvitationsData = PaginatedResult<InvitationForTable>

// The accept page goes to the invitee, so only who invited them and to which store, not the inviter's other details
export type InvitationDetails = Prisma.InvitationGetPayload<{
  include: {
    inviter: { select: { name: true; email: true } }
    organization: { select: { name: true } }
  }
}>

export interface BrandsParams extends PaginationParams {
  name?: string
  status?: Status
}

export type BrandsData = PaginatedResult<Brand>

// A category with its subcategories, as the categories tree table shows them
export type CategoryNode = Category & {
  children: CategoryNode[]
}

// A products table row. Prices are strings because Decimal can't be passed to client components
export interface ProductListItem {
  id: string
  name: string
  images: string[]
  brand: { id: string; name: string }
  baseSellPrice: string
  baseBuyPrice: string
  // From the top-level category down, e.g. "Men / Accessories": names only have to be unique among siblings
  categoryPath: string
  status: Status
  updatedAt: Date
  // Archived variants and listings aren't counted; 0 variants means a simple product
  variantCount: number
  storeCount: number
}

export interface ProductsParams extends PaginationParams {
  // Matches the name, the SKU or barcode, or any variant's SKU or barcode
  search?: string
  status?: Status
  brandId?: string
  // Includes the categories under it
  categoryId?: string
  condition?: Condition
  hasVariants?: boolean
}
export type ProductsData = PaginatedResult<ProductListItem>

// What a variant is used for, so the edit form can warn before removing it
export interface VariantUsage {
  // Ordered directly or through a store's listing: such a variant is archived instead of deleted
  ordered: boolean
  // Store listings with their own price and stock for it, which go when it's deleted
  storeCount: number
}

// The edit form's starting point. Plain values only: Decimal can't be passed to client components
export interface ProductFormData {
  id: string
  name: string
  brand: { id: string; name: string; isArchived: boolean }
  values: z.input<typeof addProductFormSchema>
  // Files already saved on the product: the form never deletes these, the update action removes replaced ones
  savedFiles: string[]
  variantUsage: Record<string, VariantUsage>
  storeCount: number
  hasOrders: boolean
}

export interface ListingsParams extends PaginationParams {
  // Matches the product's name or SKU
  search?: string
  status?: Status
}

// A store listings table row. Prices are strings because Decimal can't be passed to client components
export interface ListingListItem {
  id: string
  product: { name: string; image: string | null; brandName: string; categoryPath: string; hasVariants: boolean }
  sellPrice: string
  // The lowest and highest price a customer can pay, when variants have their own prices
  priceRange: { min: string; max: string } | null
  // A product with variants counts the stock of its variants on sale
  stock: number
  trackInventory: boolean
  // Null when stock isn't tracked or nothing is at or below the alert. For a product with variants it
  // counts the variants on sale that are out of stock (or else low), since the alert applies to each
  stockAlert: { kind: "out" | "low"; count: number } | null
  isFeatured: boolean
  status: Status
  // Why a published listing still isn't on sale (its catalogue product, or no variant on sale); null otherwise
  notOnSaleReason: string | null
  updatedAt: Date
}
export type ListingsData = PaginatedResult<ListingListItem>

// A catalogue product a store can list, for the add listing page
export interface ListableProduct {
  id: string
  name: string
  image: string | null
  brandName: string
  categoryPath: string
  baseSellPrice: string
  hasVariants: boolean
}

export type ListingSnapshot = z.infer<typeof listingSnapshotSchema>

// updateListingAction's reply when stock the user changed was changed elsewhere (a sale) while the form was open.
// It carries every row's current stock, so the form can update those fields and keep the user's other edits.
export interface StockChangedResponse {
  success: false
  error: string
  code: "STOCK_CHANGED"
  currentStock: { listing: number; variants: Record<string, number> }
}

export interface ListingVariantRow {
  variantId: string
  sku: string
  attributes: Record<string, string>
  // False for a variant added to the product after the listing was made: saving adds it
  inListing: boolean
}

// The listing form's starting point. Plain values only: Decimal can't be passed to client components
export interface ListingFormData {
  // The listing being edited; without it the form adds one
  id?: string
  product: {
    id: string
    name: string
    image: string | null
    brandName: string
    categoryPath: string
    // The catalogue's status: a listing only reaches customers while its product is published
    status: Status
    hasVariants: boolean
  }
  // The product's variants that aren't archived, in its order. values.variants follows the same order
  variants: ListingVariantRow[]
  // What the form starts from; an edit sends them back as `original` (see listingSnapshotSchema)
  values: ListingSnapshot
  // Order lines restrict deleting a listing, so an ordered one can only be archived
  hasOrders: boolean
}

export interface StoreOrdersParams extends PaginationParams {
  reference?: string
  status?: OrderStatus
  paymentStatus?: PaymentStatus
}

// Amounts are GHS strings: Decimal can't be passed to client components
export interface StoreOrderListItem {
  id: string
  reference: string
  customerName: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  shippingMethod: ShippingMethod
  // The order's total when all its items are this store's; otherwise only this store's lines, after their
  // share of the discount and with their tax
  totalGhs: string
  itemCount: number
  // Some items are other stores': the platform manages the order, and this store only sees its own lines
  isMultiStore: boolean
  createdAt: Date
}
export type StoreOrdersData = PaginatedResult<StoreOrderListItem>

export interface StoreOrderLine {
  id: string
  productName: string
  variantDescription: string | null
  sku: string | null
  productImage: string | null
  quantity: number
  unitPriceGhs: string
  totalPriceGhs: string
  discountGhs: string
  taxGhs: string
}

export interface StoreOrderDetails {
  id: string
  reference: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  paidAt: Date | null
  shippingMethod: ShippingMethod
  customer: { name: string; email: string | null; phone: string | null; isRegistered: boolean }
  // Null for a pickup order
  shipping: { name: string | null; phone: string | null; line1: string | null; line2: string | null; region: string | null; town: string | null } | null
  notes: string | null
  // This store's lines only
  lines: StoreOrderLine[]
  isMultiStore: boolean
  // The whole order's amounts, only when every line is this store's
  totals: {
    subtotalGhs: string
    discountType: DiscountType | null
    discountValue: string | null
    discountAmountGhs: string | null
    discountReason: string | null
    shippingGhs: string
    taxRate: string
    taxGhs: string
    totalGhs: string
  } | null
  // This store's lines after their share of the discount, with their tax
  storeTotalGhs: string
  exchangeRate: string
  createdBy: string | null
  createdAt: Date
  // Status changes and a recorded payment, newest first
  timeline: { id: string; title: string; note: string | null; changedBy: string | null; createdAt: Date }[]
}

// A store listing as the create order wizard offers it: one row per way to buy it (the listing, or each variant)
export interface OrderableListing {
  listingId: string
  productName: string
  brandName: string
  image: string | null
  rows: {
    listingVariantId: string | null
    // "Size: M / Colour: Red"; null for a product without variants
    variantDescription: string | null
    sku: string | null
    priceUsd: string
    // At the latest rate; null without a usable rate. The order is priced on the server when it's made.
    priceGhs: string | null
    // Null when the row doesn't track stock
    stock: number | null
  }[]
}

// A customer found by exact email or phone, with their saved addresses for the delivery step
export interface OrderCustomer {
  id: string
  name: string | null
  email: string
  phone: string | null
  addresses: { id: string; name: string; phone: string; line1: string; line2: string | null; region: string; town: string; isDefault: boolean }[]
}

// The review step's prices, from the same code that prices the order when it's created. GHS strings.
export interface OrderPreview {
  lines: { listingId: string; listingVariantId: string | null; label: string; quantity: number; unitPriceGhs: string; totalPriceGhs: string; stock: number | null }[]
  subtotalGhs: string
  discountAmountGhs: string | null
  shippingGhs: string
  taxRate: string
  taxGhs: string
  totalGhs: string
  exchangeRate: string
  rateDate: string
}
