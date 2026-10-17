import { PaginationParams, PaginatedResult } from "@workspace/contracts"
import { Brand, Category, Organization, Prisma, User } from "@workspace/db/client"
import { OrganizationStatus, Status } from "@workspace/db/enums"
import type { LucideIcon } from "lucide-react"
import type { SystemRole } from "@workspace/auth/system-permissions"

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

export type InvitationForTable = Prisma.InvitationGetPayload<{
  include: {
    inviter: true
  }
}>

export type InvitationDetails = Prisma.InvitationGetPayload<{
  include: {
    inviter: true
    organization: true
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

export type ProductListItem = Omit<ProductListRow, "baseSellPrice"> & { baseSellPrice: string }

type ProductListRow = Prisma.ProductGetPayload<{
  select: {
    id: true
    name: true
    images: true
    brand: {
      select: { id: true; name: true }
    }
    baseSellPrice: true
    category: {
      select: { name: true }
    }
    condition: true
    hasVariants: true
    status: true
    createdAt: true
  }
}>

export interface ProductsParams extends PaginationParams {
  name?: string
  status?: Status
}
export type ProductsData = PaginatedResult<ProductListItem>

export type ProductDetails = Prisma.ProductGetPayload<{
  include: {
    category: { select: { name: true } }
    variants: {
      include: {
        variantValues: {
          include: {
            optionValue: {
              include: { option: true }
            }
          }
        }
      }
    }
    variantOptions: {
      include: { values: true }
    }
    documents: true
    brand: true
  }
}>
