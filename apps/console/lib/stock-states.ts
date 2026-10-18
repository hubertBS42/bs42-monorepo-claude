import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Each listing's stock state, worked out as the table's stock badge does: from the variants on sale (or the listing
// itself, without variants), against the listing's low-stock threshold. That compares across tables, which Prisma's
// filters can't, so it's SQL; a store's listings number in the hundreds. A null store covers every store's listings.
export function stockStatesSql(storeId: string | null) {
  const inStore = storeId ? Prisma.sql`AND l."organizationId" = ${storeId}::uuid` : Prisma.empty
  return Prisma.sql`
    WITH items AS (
      SELECT l."id" AS "listingId", l."stock", l."lowStockThreshold"
      FROM "store_listing" l JOIN "product" p ON p."id" = l."productId"
      WHERE NOT p."hasVariants" ${inStore}
      UNION ALL
      SELECT l."id", v."stock", l."lowStockThreshold"
      FROM "store_listing" l
      JOIN "product" p ON p."id" = l."productId"
      JOIN "store_listing_variant" v ON v."storeListingId" = l."id"
      JOIN "product_variant" pv ON pv."id" = v."variantId"
      WHERE p."hasVariants" AND v."status" = 'PUBLISHED' AND pv."status" <> 'ARCHIVED' ${inStore}
    ),
    states AS (
      SELECT l."id", l."organizationId",
        CASE
          WHEN NOT l."trackInventory" THEN 'untracked'
          WHEN bool_or(i."stock" = 0) THEN 'out'
          WHEN bool_or(i."stock" > 0 AND i."stock" <= i."lowStockThreshold") THEN 'low'
          ELSE 'in'
        END AS "state"
      FROM "store_listing" l LEFT JOIN items i ON i."listingId" = l."id"
      WHERE TRUE ${inStore}
      GROUP BY l."id", l."organizationId", l."trackInventory"
    )`
}

export interface StockAlertCount {
  storeId: string
  low: number
  out: number
}

// How many listings each store has at or under their low-stock threshold, and out of stock, as the stock filter counts
// them. Stores with neither are left out.
export async function countStockAlerts(tx: Tx, storeId: string | null): Promise<StockAlertCount[]> {
  return tx.$queryRaw<StockAlertCount[]>`${stockStatesSql(storeId)}
    SELECT "organizationId" AS "storeId", COUNT(*) FILTER (WHERE "state" = 'low')::int AS "low", COUNT(*) FILTER (WHERE "state" = 'out')::int AS "out"
    FROM states WHERE "state" IN ('low', 'out') GROUP BY "organizationId"`
}
