import { consoleAuthClient } from "@workspace/auth/console-client"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"

/**
 * Leaving or deleting the active store clears the session's active organization, which leaves
 * the console without a workspace (an empty sidebar). This activates the platform organization
 * when the user belongs to it, otherwise their next store, like the login form does, then does a
 * full page load because the workspace changes the shared (root) layout. `globalHref` is only
 * used when the platform organization is activated; a store goes to the dashboard, and a user
 * with no store left goes to /no-stores. Throws when the next workspace can't be activated.
 */
export async function activateNextWorkspace(removedOrganizationId: string, globalHref = "/") {
  const { data, error } = await consoleAuthClient.organization.list()
  if (error) throw new Error(error.message ?? "Unable to load your stores.")

  const organizations = (data ?? []).filter((organization) => organization.id !== removedOrganizationId)
  const next = organizations.find((organization) => organization.slug === PLATFORM_ORGANIZATION_SLUG) ?? organizations[0]

  if (next) {
    const result = await consoleAuthClient.organization.setActive({ organizationId: next.id })
    if (result.error) throw new Error(result.error.message ?? "Unable to switch workspace.")
  }

  const href = !next ? "/no-stores" : next.slug === PLATFORM_ORGANIZATION_SLUG ? globalHref : "/"
  window.location.href = href
}
