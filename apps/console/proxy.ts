import { consoleAuth } from "@workspace/auth/console"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"
import { checkAccess, type RouteContext } from "@/lib/route-access"

// /accept-invitation decides for itself: a signed-out invitee goes to sign-up or login from there
const publicPaths = new Set(["/login", "/sign-up", "/reset-password", "/set-password", "/forbidden", "/setup", "/accept-invitation"])

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

// A session the login form didn't make (signing in on the storefront, which shares the session cookie) has no
// workspace. It gets the one the login form would pick: the platform organization when the user belongs to it, else
// their first store. Undefined for someone in no organization, whom the pages send to /no-stores.
async function chooseWorkspace(userId: string) {
  const platformId = await getPlatformOrganizationId()
  const memberships = await prisma.member.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { organizationId: true } })
  return (memberships.find((membership) => membership.organizationId === platformId) ?? memberships[0])?.organizationId
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Through Better Auth, which saves the session and returns its cookies: the console caches the session in a cookie for
// a minute, and the cached copy still has the old workspace. The redirect then reads the new cookies; this request's
// are the old ones. Throws when the user isn't a member of the organization.
async function switchWorkspace(request: NextRequest, organizationId: string, to: URL) {
  const { headers } = await consoleAuth.api.setActiveOrganization({ headers: request.headers, body: { organizationId }, returnHeaders: true })
  const response = NextResponse.redirect(to)
  for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie)
  return response
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

  // A link into a store's workspace from an email names the store (?store=), for someone in more than one: switch to
  // it, then the same page without the parameter. Better Auth refuses a store the user isn't a member of, and the page
  // then goes on in the workspace the session had.
  const linkedStoreId = request.nextUrl.searchParams.get("store")
  if (linkedStoreId !== null) {
    const target = request.nextUrl.clone()
    target.searchParams.delete("store")
    if (linkedStoreId === activeOrganizationId || !UUID.test(linkedStoreId)) return NextResponse.redirect(target)
    try {
      return await switchWorkspace(request, linkedStoreId, target)
    } catch {
      return NextResponse.redirect(target)
    }
  }

  if (!activeOrganizationId) {
    const organizationId = await chooseWorkspace(session.user.id)
    if (organizationId) {
      try {
        return await switchWorkspace(request, organizationId, request.nextUrl)
      } catch (error) {
        console.error("Could not choose a workspace for the session:", error)
      }
    }
  }

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
