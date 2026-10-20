import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"
import { Status } from "@workspace/db/enums"

// A published brand by its slug, or null
export const getBrand = unstable_cache(
  async (slug: string) =>
    prisma.brand.findFirst({
      where: { slug, status: Status.PUBLISHED },
      select: { id: true, name: true, slug: true, logo: true, description: true, website: true },
    }),
  ["store-brand"],
  { revalidate: 60 }
)
