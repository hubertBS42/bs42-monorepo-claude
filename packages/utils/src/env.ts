export function parsePositiveIntegerEnv(
  value: string | undefined,
  name: string,
  defaultValue: number
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}
