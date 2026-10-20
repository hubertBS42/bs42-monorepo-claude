import { prisma } from "@workspace/db"

import { countCartItems } from "@/lib/cart"
import { readCartId } from "@/lib/cart-cookie"

// The header's basket count (components/basket/basket-count.ts)
export async function GET() {
  const cartId = await readCartId()
  const count = cartId ? await countCartItems(prisma, cartId) : 0
  return Response.json({ count }, { headers: { "Cache-Control": "private, no-store" } })
}
