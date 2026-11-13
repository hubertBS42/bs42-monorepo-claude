import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/structured-data"

// Made again as the app runs, so the sitemap's address is the running app's STORE_AUTH_URL, not the build's
export const revalidate = 60

// Category and brand pages with a query (filters, sorting, later pages) stay out of crawlers' way: the filters are
// links, so every combination is an address, and each already names its plain page as canonical. Products reach
// search engines through the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/c/*?", "/b/*?"] },
    sitemap: siteUrl("/sitemap.xml"),
  }
}
