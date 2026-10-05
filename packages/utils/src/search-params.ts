export type SearchParamValue = string | string[] | undefined

export function getStringParam(value: SearchParamValue): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function getPositiveIntegerParam(
  value: SearchParamValue,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  const stringValue = getStringParam(value)
  if (!stringValue || !/^\d+$/.test(stringValue)) return fallback

  const parsed = Number(stringValue)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback
}

export function getSortParam<const T extends string>(
  value: SearchParamValue,
  allowedSortFields: readonly T[]
): T | undefined {
  const sort = getStringParam(value)
  return allowedSortFields.find((field) => field === sort)
}

export function getOrderParam(
  value: SearchParamValue
): "asc" | "desc" | undefined {
  const order = getStringParam(value)
  return order === "asc" || order === "desc" ? order : undefined
}
