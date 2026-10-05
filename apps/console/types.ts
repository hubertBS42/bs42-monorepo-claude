import { PaginationParams, PaginatedResult } from "@workspace/contracts"
import { Brand, Organization, Prisma, User } from "@workspace/db/client"
import { OrganizationStatus } from "@workspace/db/enums"
import type { LucideIcon } from "lucide-react"

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
  context?: ("global" | "store")[]
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

export type StoreForSelect = Prisma.OrganizationGetPayload<{
  select: {
    id: true
    name: true
  }
}>

export type Store = Omit<Organization, "status"> & {
  status: StoreStatus
}

export type StoresData = PaginatedResult<Store>

export interface StoresParams extends PaginationParams {
  name?: string
}

export type UsersData = PaginatedResult<User>

export interface UsersParams extends PaginationParams {
  name?: string
  email?: string
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
}

export type BrandsData = PaginatedResult<Brand>

export type BrandForSelect = Prisma.BrandGetPayload<{
  select: {
    id: true
    name: true
  }
}>
