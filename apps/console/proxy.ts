import { consoleAuth } from "@workspace/auth/console"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"
import { checkAccess, type RouteContext } from "@/lib/route-access"

const publicPaths = new Set(["/login", "/sign-up", "/reset-password", "/set-password", "/forbidden", "/setup"])

// The platform organization's id never changes, so look it up once per server instance.
// It is only cached after it exists, so a request made before setup doesn't pin "undefined".
let platformOrganizationId: string | undefined

async function getPlatformOrganizationId() {
  if (platformOrganizationId) return platformOrganizationId

  const organization = await prisma.organization.findUnique({
    where: { slug: PLATFORM_ORGANIZATION_SLUG },
    select: { id: true },
  })

  platformOrganizationId = organization?.id
  return platformOrganizationId
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("callbackURL", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(loginUrl)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicPath = publicPaths.has(pathname) || [...publicPaths].some((path) => pathname.startsWith(`${path}/`))

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Cheap check first: with no session cookie there is nothing to look up
  if (!getSessionCookie(request)) {
    return redirectToLogin(request)
  }

  // Served from the signed cookie cache when it is enabled, otherwise this is a database read
  const session = await consoleAuth.api.getSession({ headers: request.headers })
  if (!session) {
    return redirectToLogin(request)
  }

  const activeOrganizationId = session.session.activeOrganizationId

  // Without an active organization the context is unknown, so only the role is checked here
  let context: RouteContext | undefined
  if (activeOrganizationId) {
    context = activeOrganizationId === (await getPlatformOrganizationId()) ? "global" : "store"
  }

  const access = checkAccess(pathname, session.user.role, context)

  if (access === "role") {
    return NextResponse.redirect(new URL("/forbidden", request.url))
  }

  // A page from the other workspace: send the user to the dashboard, which both contexts allow
  if (access === "context") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images/).*)"],
}
