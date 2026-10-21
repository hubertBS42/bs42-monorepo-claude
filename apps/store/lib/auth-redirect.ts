// The account pages (sign in, sign up and the email links' pages): signing in from one of them goes home
export const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"]

// Where to go after signing in: a page on this site only. A full URL, or "//host" (protocol-relative), would send a
// customer off the site from a link someone else made.
export function safeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/"
  return value
}

// A link to the sign-in or sign-up page that comes back to `from` afterwards
export function signInHref(page: "/sign-in" | "/sign-up", from: string) {
  const back = safeRedirect(from)
  return back === "/" || AUTH_PAGES.some((path) => back.startsWith(path)) ? page : `${page}?redirect=${encodeURIComponent(back)}`
}

// Where the email's confirmation link lands (it signs the customer in), keeping where they were going
export function verifyEmailHref(redirectTo: string) {
  return redirectTo === "/" ? "/verify-email" : `/verify-email?redirect=${encodeURIComponent(redirectTo)}`
}
