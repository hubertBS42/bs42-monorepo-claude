export function formatDuration(seconds: number) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new RangeError(
      "Duration must be a positive integer number of seconds"
    )
  }

  const units = [
    { seconds: 86400, label: "day" },
    { seconds: 3600, label: "hour" },
    { seconds: 60, label: "minute" },
    { seconds: 1, label: "second" },
  ] as const

  const unit = units.find((candidate) => seconds >= candidate.seconds)!
  const count = Math.floor(seconds / unit.seconds)
  return `${count} ${unit.label}${count === 1 ? "" : "s"}`
}

const formatGhs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  currencyDisplay: "symbol",
})

export function formatCurrencyGhs(amount: number) {
  if (!Number.isFinite(amount)) {
    throw new TypeError("Currency amount must be a finite number")
  }

  return formatGhs.format(amount)
}
