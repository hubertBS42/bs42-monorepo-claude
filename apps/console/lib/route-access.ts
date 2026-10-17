import { hasSystemRole, type SystemRole } from "@workspace/auth/system-permissions"

export type RouteContext = "global" | "store"
export type AccessResult = "allowed" | "role" | "context"

interface RouteAccess {
  roles: readonly SystemRole[]
  contexts: readonly RouteContext[]
}

const allRoles = ["superAdmin", "admin", "user"] as const satisfies readonly SystemRole[]
const adminRoles = ["superAdmin", "admin"] as const satisfies readonly SystemRole[]
const bothContexts = ["global", "store"] as const satisfies readonly RouteContext[]

/**
 * Pure data, with no React or icons, so the proxy can import it cheaply.
 * Titles, icons and menu order live in the nav config, which the sidebar filters
 * with checkAccess so the menu and the proxy always agree.
 */
export const routeAccess: Record<string, RouteAccess> = {
  "/": { roles: allRoles, contexts: bothContexts },

  // Global workspace
  "/catalogue": { roles: adminRoles, contexts: ["global"] },
  "/stores": { roles: adminRoles, contexts: ["global"] },
  "/users": { roles: adminRoles, contexts: ["global"] },
  "/orders": { roles: adminRoles, contexts: ["global"] },
  "/settings": { roles: ["superAdmin"], contexts: ["global"] },

  // Store workspace
  "/store": { roles: allRoles, contexts: ["store"] },

  // Both
  "/account": { roles: allRoles, contexts: bothContexts },
  "/account/profile": { roles: allRoles, contexts: bothContexts },
  "/account/password": { roles: allRoles, contexts: bothContexts },
  "/account/sessions": { roles: allRoles, contexts: bothContexts },
}

// Longest first so "/account/profile" wins over any shorter prefix. Computed once.
const sortedRoutes = Object.keys(routeAccess).sort((a, b) => b.length - a.length)

/**
 * `context` is undefined when the session has no active organization yet. The role is
 * still checked, and the context check is left to the page-level guards.
 */
export function checkAccess(pathname: string, role: string | null | undefined, context?: RouteContext): AccessResult {
  const route = sortedRoutes.find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`))

  // Unlisted paths (for example /no-stores or /accept-invitation) are left to the page-level guards.
  // For default deny, return "role" here and add those paths to routeAccess.
  if (!route) return "allowed"

  const rule = routeAccess[route]!

  if (!hasSystemRole(role, rule.roles)) return "role"
  if (context && !rule.contexts.includes(context)) return "context"

  return "allowed"
}

export function canAccess(pathname: string, role: string | null | undefined, context?: RouteContext): boolean {
  return checkAccess(pathname, role, context) === "allowed"
}
