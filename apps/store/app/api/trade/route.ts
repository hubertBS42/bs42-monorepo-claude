import { getTradeTerms } from "@/lib/session"

// The shelf's trade prices (components/trade/trade-state.ts): the signed-in customer's trade discount, a percentage, or
// null without an approved trade account. Pages are cached and shared, so they ask here.
export async function GET() {
  const terms = await getTradeTerms()
  return Response.json({ percent: terms?.percent.toString() ?? null }, { headers: { "Cache-Control": "private, no-store" } })
}
