export function formatCurrency(amount: number | string | null, currency: string = "USD", locale: string = "en-US", options?: Intl.NumberFormatOptions) {
  const formatter = new Intl.NumberFormat(locale, {
    currency: currency,
    style: "currency",
    minimumFractionDigits: 2,
    ...options,
  })

  if (typeof amount === "number") {
    return formatter.format(amount)
  } else if (typeof amount === "string") {
    const parsed = Number(amount)
    return isNaN(parsed) ? "NaN" : formatter.format(parsed)
  } else {
    return "NaN"
  }
}
