import type { PaginationParams } from "@workspace/contracts"

export interface PaginationValidationOptions {
  maxPageSize: number
  allowedSortFields: readonly string[]
}

export function getPaginationError(
  params: PaginationParams,
  options: PaginationValidationOptions
): string | null {
  const { page, pageSize, sort, order } = params
  const { maxPageSize, allowedSortFields } = options

  if (page !== undefined && (!Number.isSafeInteger(page) || page < 1)) {
    return "Page must be a positive integer."
  }

  if (
    pageSize !== undefined &&
    (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize)
  ) {
    return `Page size must be an integer between 1 and ${maxPageSize}.`
  }

  if (sort !== undefined && !allowedSortFields.includes(sort)) {
    return "Unsupported sort field."
  }

  if (order !== undefined && order !== "asc" && order !== "desc") {
    return "Sort order must be either 'asc' or 'desc'."
  }

  return null
}
