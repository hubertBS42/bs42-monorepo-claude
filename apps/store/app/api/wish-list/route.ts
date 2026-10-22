import { prisma } from "@workspace/db"

import { getStoreSession } from "@/lib/session"
import { getWishListKeys } from "@/lib/wish-list"

// The hearts' saved state and the header's count (components/wish-list/wish-list-state.ts). Null items when signed out.
export async function GET() {
  const session = await getStoreSession()
  const items = session ? await getWishListKeys(prisma, session.user.id) : null
  return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } })
}
