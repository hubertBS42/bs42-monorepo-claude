import { formatCurrency } from "@workspace/utils/currency"

export const formatGhs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")
