import { PaginationParams, PaginatedResult } from "@workspace/contracts"
import { Brand, Category, Organization, Prisma, User } from "@workspace/db/client"
import {
  Condition,
  Currency,
  DiscountType,
  InstallationStatus,
  OrderStatus,
  OrganizationStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  PurchaseOrderStatus,
  ReviewStatus,
  ShippingMethod,
  SpecType,
  Status,
  StockMovementReason,
  BusinessType,
  TradeAccountStatus,
} from "@workspace/db/enums"
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
  // Active only on its own page, not on the pages under its url (the store's details at /store)
  exact?: boolean
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

export interface ReviewsParams extends PaginationParams {
  // The product's name, the customer's name or email, or the review's title
  search?: string
  productId?: string
  rating?: number
  status?: ReviewStatus
}

// A review as the moderation table shows it
export interface ReviewRow {
  id: string
  rating: number
  title: string
  body: string
  variantLabel: string | null
  status: ReviewStatus
  hiddenReason: string | null
  hiddenByName: string | null
  createdAt: Date
  product: { id: string; name: string }
  customer: { name: string | null; email: string }
}

export type ReviewsData = PaginatedResult<ReviewRow>

// A category with its subcategories, as the categories tree table shows them
// Without the installation fee, a Decimal: the tree goes to client components
export type CategoryNode = Omit<Category, "installationFeeGhs"> & {
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

// A category spec as the product form shows it
export interface SpecField {
  id: string
  name: string
  type: SpecType
  unit: string | null
  options: { id: string; value: string }[]
}

// A spec on the category's edit page. updatedAt is the version the edit dialog sends back.
export interface CategorySpecRow extends SpecField {
  isFilterable: boolean
  updatedAt: string
  // Products with a value for it, which deleting it clears
  productCount: number
}

// The category's own specs, and those it gets from the categories above it (nearest last)
export interface CategorySpecsData {
  own: CategorySpecRow[]
  inherited: (SpecField & { categoryName: string })[]
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

// What a listings row's stock badge shows: any item sold out, else any at or below the low-stock threshold
export const LISTING_STOCK_STATES = ["in", "low", "out", "untracked"] as const
export type ListingStockState = (typeof LISTING_STOCK_STATES)[number]

export interface ListingsParams extends PaginationParams {
  // Matches the product's name or SKU
  search?: string
  status?: Status
  stock?: ListingStockState
  brandId?: string
  // Includes its subcategories
  categoryId?: string
  // "true": customers can buy it; "false": they can't (a draft, or published but its product or every variant isn't)
  visible?: "true" | "false"
}

// A store listings table row. Prices are strings because Decimal can't be passed to client components
export interface ListingListItem {
  id: string
  // The ids open the catalogue's product and brand pages, for system admins
  product: { id: string; name: string; image: string | null; brandId: string; brandName: string; categoryPath: string; hasVariants: boolean }
  sellPrice: string
  // The lowest and highest price a customer can pay, when variants have their own prices
  priceRange: { min: string; max: string } | null
  // A product with variants counts the stock of its variants on sale
  stock: number
  trackInventory: boolean
  // Null when stock isn't tracked or nothing is at or below the alert. For a product with variants it
  // counts the variants on sale that are out of stock (or else low), since the alert applies to each
  stockAlert: { kind: "out" | "low"; count: number } | null
  // Still to come on the store's open purchase orders, across the listing and its variants
  incoming: number
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

// The platform's orders list: every order, from every store
export interface OrdersParams extends PaginationParams {
  reference?: string
  // Matches the customer's name, email or phone
  customer?: string
  storeId?: string
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  // "true": only orders with more than one store's items; "false": only single-store orders
  multiStore?: "true" | "false"
  // "true": only orders with items brought back; "false": only orders without
  returned?: "true" | "false"
  // "true": only orders placed by a trade account; "false": only orders without
  trade?: "true" | "false"
  // Plain yyyy-MM-dd days in the app's time zone, both inclusive
  placedStart?: string
  placedEnd?: string
}

// Amounts are GHS strings: Decimal can't be passed to client components
export interface OrderListItem {
  id: string
  reference: string
  customerName: string
  // The trade account's company, for its orders
  tradeCompanyName: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  shippingMethod: ShippingMethod
  totalGhs: string
  itemCount: number
  // The stores whose items are on the order, by the name they had when it was placed
  storeNames: string[]
  // "Returned" or "Partly returned" once items were brought back
  returned: string | null
  createdAt: Date
}
export type OrdersData = PaginatedResult<OrderListItem>

export interface OrderLine {
  id: string
  productName: string
  variantDescription: string | null
  sku: string | null
  productImage: string | null
  // The store's name when the order was placed
  storeName: string
  quantity: number
  // Units the customer has brought back since
  returnedQuantity: number
  unitPriceGhs: string
  totalPriceGhs: string
  discountGhs: string
  taxGhs: string
  // Installation of every unit, before tax; null when not installed
  installationGhs: string | null
}

// The whole order's amounts
export interface OrderTotals {
  subtotalGhs: string
  discountType: DiscountType | null
  discountValue: string | null
  discountAmountGhs: string | null
  discountReason: string | null
  shippingGhs: string
  installationGhs: string
  taxRate: string
  taxGhs: string
  totalGhs: string
}

// An order's installation, which the platform's staff arrange
export interface OrderInstallation {
  status: InstallationStatus
  // The booked day (yyyy-MM-dd)
  date: string | null
  // What cancelling it would refund: the installation of the units not brought back, with its tax
  leftGhs: string
}

export interface OrderTimelineEntry {
  id: string
  title: string
  note: string | null
  changedBy: string | null
  createdAt: Date
}

// What the store's and the platform's order pages both show
interface OrderDetailsBase {
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
  lines: OrderLine[]
  isMultiStore: boolean
  exchangeRate: string
  createdBy: string | null
  createdAt: Date
  // Status changes, a recorded payment and refunds, newest first
  timeline: OrderTimelineEntry[]
  // Each "Pay" on the storefront, newest first; none for a staff order
  paymentAttempts: OrderPaymentAttempt[]
  // Null for an order without installation
  installation: OrderInstallation | null
  // Placed by a trade account: the company and TIN copied onto the order, and the account (null if since deleted)
  trade: { accountId: string | null; companyName: string; tin: string | null } | null
  // Placed by accepting a quotation: its reference, and its storefront page (signed) for store staff, who can't open
  // the console's quotation pages
  quote: { id: string; reference: string; url: string } | null
}

// One try at paying a storefront order on Paystack
export interface OrderPaymentAttempt {
  id: string
  reference: string
  // Null where the viewer sees only their own lines of the order
  amountGhs: string | null
  status: PaymentAttemptStatus
  channel: string | null
  gatewayResponse: string | null
  paidAt: Date | null
  createdAt: Date
}

export interface StoreOrderDetails extends OrderDetailsBase {
  // Only when every line is this store's; lines holds this store's lines only
  totals: OrderTotals | null
  // This store's lines after their share of the discount, with their tax
  storeTotalGhs: string
  // Refunds and returns, only when every line is this store's (otherwise the platform handles them)
  afterSale: OrderAfterSale | null
}

// Items a customer brought back, as the platform's order page lists them
export interface OrderReturnEntry {
  id: string
  reason: string
  // What was refunded with it; null when nothing was
  refundGhs: string | null
  recordedBy: string | null
  createdAt: Date
  items: { productName: string; variantDescription: string | null; quantity: number; restocked: boolean }[]
}

// A line the return form offers: one with units still to come back
export interface ReturnableLine {
  orderItemId: string
  productName: string
  variantDescription: string | null
  storeName: string
  // Units that can still come back
  left: number
  // Only a line whose sale took stock (its row tracked it then) can have units put back
  tracksStock: boolean
  // What returning 0, 1, ... left of its units is worth (GHS strings): their share of what was paid for the line
  valueByQuantity: string[]
}

// Money given back and items brought back, for whoever manages the order
export interface OrderAfterSale {
  // The sum of the order's refunds so far, and what's left to refund (the total less that)
  refundedGhs: string
  refundableGhs: string
  returns: OrderReturnEntry[]
  returnableLines: ReturnableLine[]
}

// The platform's view: every line, from every store
export interface OrderDetails extends OrderDetailsBase, OrderAfterSale {
  totals: OrderTotals
  storeNames: string[]
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

// The dashboard's period: the last 7, 30 or 90 days including today, in the app's time zone. Each is compared with
// the same number of days before it.
export const DASHBOARD_PERIODS = ["7d", "30d", "90d"] as const
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

// Money is counted when it moves: payments by the day they were recorded, refunds by the day they were given
export interface DashboardSales {
  // Payments recorded in the period, less the refunds given in it
  netSalesGhs: string
  paidOrders: number
  // The paid orders' average, before refunds; null without any
  averageOrderGhs: string | null
  refundedGhs: string
  refunds: number
  returns: number
}

// The change from the previous period, as a percentage rounded to one decimal; null when the previous period had none
export interface DashboardChanges {
  netSales: number | null
  paidOrders: number | null
  averageOrder: number | null
  refunded: number | null
}

export interface DashboardSalesTrend {
  current: DashboardSales
  changes: DashboardChanges
  // One per day of the current period, oldest first, for the chart
  days: { date: string; netSalesGhs: string }[]
}

// Orders waiting on someone, each with the list filter that shows them
export interface DashboardOrderCounts {
  pending: number
  confirmed: number
  processing: number
  // Delivered with no payment recorded yet
  unpaidDelivered: number
}

export interface StoreDashboard {
  orders: DashboardOrderCounts
  // Listings at or under their low-stock threshold, and out of stock
  lowStock: number
  outOfStock: number
  sales: DashboardSalesTrend
}

export interface PlatformDashboard {
  orders: DashboardOrderCounts & {
    // Pending orders with more than one store's items, which only the platform can confirm
    multiStorePending: number
  }
  // Stores with listings low on or out of stock, most out of stock first
  stockAlerts: { storeId: string; storeName: string; low: number; out: number }[]
  sales: DashboardSalesTrend
}

// ============================================
// PURCHASING
// ============================================

export interface SuppliersParams extends PaginationParams {
  name?: string
  archived?: boolean
}

export interface SupplierListItem {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  isArchived: boolean
  purchaseOrderCount: number
}

export type SuppliersData = PaginatedResult<SupplierListItem>

export interface SupplierDetails {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isArchived: boolean
  purchaseOrderCount: number
}

export interface PurchaseOrdersParams extends PaginationParams {
  reference?: string
  status?: PurchaseOrderStatus
  supplierId?: string
}

export interface PurchaseOrderListItem {
  id: string
  reference: string
  supplierName: string
  status: PurchaseOrderStatus
  currency: Currency
  // In the order's currency, with shipping
  total: string
  quantityOrdered: number
  quantityReceived: number
  // yyyy-MM-dd
  expectedOn: string | null
  // Still open and past its expected day
  isOverdue: boolean
  createdAt: Date
}

export type PurchaseOrdersData = PaginatedResult<PurchaseOrderListItem>

export interface PurchaseOrderLine {
  id: string
  listingId: string
  listingVariantId: string | null
  productName: string
  variantDescription: string | null
  sku: string | null
  quantityOrdered: number
  quantityReceived: number
  // In the order's currency, and in USD
  unitCost: string
  unitCostUsd: string
  total: string
  // The listing (or variant) row now: null stock when it doesn't track it
  stock: number | null
}

export interface PurchaseOrderReceiptEntry {
  id: string
  createdAt: Date
  receivedBy: string | null
  note: string | null
  updatedBuyPrices: boolean
  items: { label: string; quantity: number }[]
}

export interface PurchaseOrderDetails {
  id: string
  reference: string
  status: PurchaseOrderStatus
  supplier: { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; isArchived: boolean }
  currency: Currency
  // GHS per 1 USD, for an order in GHS
  exchangeRate: string | null
  shippingCost: string
  subtotal: string
  total: string
  // yyyy-MM-dd
  expectedOn: string | null
  isOverdue: boolean
  notes: string | null
  createdAt: Date
  createdBy: string | null
  orderedAt: Date | null
  orderedBy: string | null
  closedAt: Date | null
  closedBy: string | null
  closeReason: string | null
  // updatedAt as ISO: the version an edit form sends back
  version: string
  lines: PurchaseOrderLine[]
  receipts: PurchaseOrderReceiptEntry[]
}

// A store listing as the purchase order form offers it: one row per thing to buy (the listing, or each variant)
export interface PurchasableListing {
  listingId: string
  productName: string
  brandName: string
  image: string | null
  rows: {
    listingVariantId: string | null
    variantDescription: string | null
    sku: string | null
    // The last buy price (the variant's, the listing's or the catalogue's), in USD, as a starting cost
    buyPriceUsd: string | null
    // Null when the row doesn't track stock
    stock: number | null
    incoming: number
  }[]
}

// ============================================
// STOCK HISTORY
// ============================================

export interface StockHistoryParams extends PaginationParams {
  reason?: StockMovementReason
  // A variant on the listing (StoreListingVariant.id)
  variantId?: string
}

export interface StockMovementItem {
  id: string
  createdAt: Date
  // "Size: M / Colour: Red"; null for a product without variants
  variantDescription: string | null
  change: number
  stockAfter: number
  reason: StockMovementReason
  note: string | null
  createdBy: string | null
  // What caused it: the order, or the purchase order a delivery was on
  source: { label: string; href: string } | null
}

export interface StockHistoryData {
  listing: { id: string; productName: string; hasVariants: boolean; variants: SelectItem[] }
  movements: PaginatedResult<StockMovementItem>
}

// ============================================
// TRADE ACCOUNTS
// ============================================

export interface TradeAccountsParams extends PaginationParams {
  // Company name, registration number, TIN, or the customer's name or email
  search?: string
  status?: TradeAccountStatus
  businessType?: BusinessType
}

export interface TradeAccountRow {
  id: string
  companyName: string
  businessType: BusinessType
  status: TradeAccountStatus
  // A percentage; null until approved
  discountPercent: string | null
  customer: { name: string | null; email: string }
  orderCount: number
  createdAt: Date
}

export type TradeAccountsData = PaginatedResult<TradeAccountRow>

export interface TradeAccountDetails extends TradeAccountRow {
  registrationNumber: string
  tin: string
  phone: string
  details: string | null
  rejectionReason: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  // Its orders' totals and discounts, cancelled ones left out (GHS strings)
  ordersTotalGhs: string
  discountGivenGhs: string
  recentOrders: { id: string; reference: string; status: OrderStatus; paymentStatus: PaymentStatus; totalGhs: string; createdAt: Date }[]
}

// ============================================
// QUOTATIONS
// ============================================

// "expired" is an open quote past its date, worked out rather than stored
export type QuoteStatusFilter = "open" | "expired" | "accepted" | "cancelled"

export interface QuotesParams extends PaginationParams {
  // Reference, customer name or email, or the trade account's company
  search?: string
  status?: QuoteStatusFilter
  // "true": only quotes made by a trade account; "false": only quotes without
  trade?: "true" | "false"
  // Plain yyyy-MM-dd days in the app's time zone, both inclusive
  madeStart?: string
  madeEnd?: string
  // "customer": made from a basket on the storefront; "staff": made in the console
  madeBy?: "customer" | "staff"
}

export interface QuoteRow {
  id: string
  reference: string
  customer: { name: string; email: string; phone: string }
  tradeCompanyName: string | null
  lineCount: number
  totalGhs: string
  status: QuoteStatusFilter
  // The last day its prices hold
  validUntil: Date
  // The order accepting it placed
  order: { id: string; reference: string } | null
  // The staff member who made it; null when the customer did
  createdBy: string | null
  createdAt: Date
}

export type QuotesData = PaginatedResult<QuoteRow>

// A customer found by exact email or phone for a quotation, with their approved trade account's terms when they have
// one (the discount the form starts from)
export interface QuoteCustomer extends OrderCustomer {
  trade: { percent: string; companyName: string } | null
}

// The review step's prices, from the same code that prices the quotation when it's saved. GHS strings.
export interface QuotePreview {
  lines: {
    key: string
    label: string
    quantity: number
    unitPriceGhs: string
    totalPriceGhs: string
    // The line's installation, or null without
    installationGhs: string | null
    // Null when the row doesn't track stock
    stock: number | null
  }[]
  subtotalGhs: string
  discountAmountGhs: string | null
  installationGhs: string
  shippingGhs: string
  taxRate: string
  taxGhs: string
  totalGhs: string
  exchangeRate: string
}

// What the create form shows for a chosen line. The form itself holds only ids, quantities and installation: prices
// are looked up on the server.
export interface ChosenQuoteItem {
  label: string
  sku: string | null
  // Before tax at today's rate; null for a line copied from another quotation until it's priced
  priceGhs: string | null
  stock: number | null
  // Installing one unit; null when the product doesn't offer it
  installationFeeGhs: string | null
}

// "Copy to a new quotation": the create form's starting values
export interface QuoteCopy {
  reference: string
  customer: QuoteCustomer | null
  values: {
    customerUserId: string | null
    customerName: string
    customerEmail: string
    customerPhone: string
    items: { listingId: string; listingVariantId: string | null; quantity: number; installation: boolean }[]
    shippingLine1: string
    shippingLine2: string
    shippingRegion: string
    shippingTown: string
    shippingGhs: number
    notes: string
    discountType: "NONE" | "FIXED" | "PERCENTAGE"
    discountValue: number
    discountReason: string
  }
  chosen: Record<string, ChosenQuoteItem>
  // Lines left out because their listing is gone
  left: number
}

// A quotation as its console page shows it
export interface QuoteDetails {
  id: string
  reference: string
  // The storefront's quotation page, signed so staff can open it
  url: string
  status: QuoteStatusFilter
  createdAt: Date
  // The last day its prices hold
  validUntil: Date
  // The staff member who made it; null when the customer did
  createdBy: string | null
  customer: { name: string; email: string; phone: string; hasAccount: boolean }
  trade: { companyName: string; tin: string | null } | null
  address: string
  notes: string | null
  exchangeRate: string
  lines: { id: string; label: string; sku: string | null; storeName: string; quantity: number; unitPriceGhs: string; totalPriceGhs: string; installationGhs: string | null }[]
  totals: { subtotalGhs: string; discountAmountGhs: string | null; discountReason: string | null; installationGhs: string; shippingGhs: string; taxRate: string; taxGhs: string; totalGhs: string }
  order: { id: string; reference: string } | null
}
