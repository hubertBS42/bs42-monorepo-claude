export type SearchParamValue = string | string[] | undefined

export function getStringParam(value: SearchParamValue): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function getPositiveIntegerParam(value: SearchParamValue, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const stringValue = getStringParam(value)
  if (!stringValue || !/^\d+$/.test(stringValue)) return fallback

  const parsed = Number(stringValue)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}

// Returns the value only when it's one of the allowed values (e.g. a filter backed by a fixed list)
export function getEnumParam<const T extends string>(value: SearchParamValue, allowedValues: readonly T[]): T | undefined {
  const stringValue = getStringParam(value)
  return allowedValues.find((allowed) => allowed === stringValue)
}

export function getSortParam<const T extends string>(value: SearchParamValue, allowedSortFields: readonly T[]): T | undefined {
  const sort = getStringParam(value)
  return allowedSortFields.find((field) => field === sort)
}

export function getOrderParam(value: SearchParamValue): "asc" | "desc" | undefined {
  const order = getStringParam(value)
  return order === "asc" || order === "desc" ? order : undefined
}

// A plain yyyy-MM-dd day (what the date filters write), only when it's a real calendar day
export function getDayParam(value: SearchParamValue): string | undefined {
  const day = getStringParam(value)
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined

  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  const parsed = new Date(Date.UTC(year, month - 1, date))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day : undefined
}
