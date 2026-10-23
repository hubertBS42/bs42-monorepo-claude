import type { QuoteStatusFilter } from "@/types"

// How a quotation's status shows, on its page and in the list. Like orders: accepted is done, expired and cancelled
// are muted, open is still in play.
export const QUOTE_STATUS: Record<QuoteStatusFilter, { label: string; variant: "outline" | "secondary" | "success" }> = {
  open: { label: "Open", variant: "outline" },
  expired: { label: "Expired", variant: "secondary" },
  accepted: { label: "Accepted", variant: "success" },
  cancelled: { label: "Cancelled", variant: "secondary" },
}
