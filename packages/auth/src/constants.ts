// Kept free of side effects (no secret checks, no server-only) so plugin code that the
// auth CLI loads can import it too.
const isProduction = process.env.NODE_ENV === "production"

// The storefront's sign-up form sends this header, "ok" when its hidden field is empty. Bots that fill in every field,
// or post to the sign-up endpoint without the form, are refused (storeAuth's hooks); people never see the field.
export const SIGN_UP_CHECK_HEADER = "x-bs42-sign-up"
export const SIGN_UP_CHECK_PASSED = "ok"

export const authURLs = {
  store: process.env.STORE_AUTH_URL ?? (isProduction ? "https://bs42.net" : "http://localhost:3001"),
  console: process.env.CONSOLE_AUTH_URL ?? (isProduction ? "https://console.bs42.net" : "http://localhost:3000"),
}
