export interface DocumentItem {
  name: string
  url: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sort?: string
  order?: string
}

interface SuccessResponse<T> {
  success: true
  data: T
}

interface ErrorResponse {
  success: false
  error: string
  code?: string
}

export type DataResponse<T> = SuccessResponse<T> | ErrorResponse
export type ActionResponse = { success: true } | ErrorResponse

export type AppSettingsData = {
  storeName: string
  storeDescription: string | null
  consoleName: string | null
  consoleDescription: string | null
  logoUrl: string | null
  faviconUrl: string | null
  // Tax on orders. taxRate is a fraction (0.15 is 15%) as a plain number, so it can reach client components and
  // the settings cache. Checkout maths should read AppSettings.taxRate as a Decimal instead.
  taxEnabled: boolean
  taxRate: number
  taxShipping: boolean
}
