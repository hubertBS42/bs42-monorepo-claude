import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
