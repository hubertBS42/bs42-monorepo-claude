import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

// The old bs42.net's products were at /product/<slug>. Most kept their slug at /p/<slug>; this file lists the ones the
// migration renamed or merged (old slug → the production product's slug, from seed-products.json's `from`), so links
// and search results reach the product. A slug that leads nowhere still ends at the product page's 404.
const oldProductAddresses: Record<string, string> = JSON.parse(readFileSync(new URL("./old-product-addresses.json", import.meta.url), "utf8"))

// Sent with every response: other sites can't show these pages in a frame (so they can't trick someone into clicking
// a button they can't see), browsers don't guess file types, and other sites only learn the origin a visitor came from.
// HSTS keeps browsers on HTTPS once they've seen it (they ignore it over plain HTTP, as on localhost).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
]

const nextConfig: NextConfig = {
  // A self-contained server for App Service (.next/standalone, started with `node apps/<app>/server.js`), traced from
  // the monorepo's root so it takes in the workspace packages. Only when the deploy workflow asks: `next start`, as
  // used locally, doesn't run standalone builds.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: ["@workspace/ui"],
  poweredByHeader: false,
  // The old bs42.net listed its posts at /blogs; each post kept its /blog/<slug> address
  async redirects() {
    return [
      // One address for the site: www.bs42.net serves the same app, so search engines would crawl every page twice
      { source: "/:path*", has: [{ type: "host", value: "www.bs42.net" }], destination: "https://bs42.net/:path*", permanent: true },
      { source: "/blogs", destination: "/blog", permanent: true },
      ...Object.entries(oldProductAddresses).map(([from, to]) => ({ source: `/product/${from}`, destination: `/p/${to}`, permanent: true })),
      { source: "/product/:slug", destination: "/p/:slug", permanent: true },
    ]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
