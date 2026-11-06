import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/structured-data"

// Made again as the app runs, so the sitemap's address is the running app's STORE_AUTH_URL, not the build's
export const revalidate = 60

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: siteUrl("/sitemap.xml"),
  }
}
