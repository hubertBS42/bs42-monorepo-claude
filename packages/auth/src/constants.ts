// Kept free of side effects (no secret checks, no server-only) so plugin code that the
// auth CLI loads can import it too.
const isProduction = process.env.NODE_ENV === "production"

export const authURLs = {
  store: process.env.STORE_AUTH_URL ?? (isProduction ? "https://bs42.net" : "http://localhost:3001"),
  console: process.env.CONSOLE_AUTH_URL ?? (isProduction ? "https://console.bs42.net" : "http://localhost:3000"),
}
