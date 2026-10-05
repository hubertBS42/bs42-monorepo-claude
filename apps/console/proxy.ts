import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

const publicPaths = new Set(["/login", "/sign-up", "/reset-password", "/set-password", "/forbidden", "/setup"])

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicPath = publicPaths.has(pathname) || [...publicPaths].some((path) => pathname.startsWith(`${path}/`))

  if (isPublicPath) {
    return NextResponse.next()
  }

  if (getSessionCookie(request)) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("callbackURL", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images/).*)"],
}
