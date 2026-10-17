"use client"

import { useEffect, useState } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import type { OrgRole } from "@workspace/auth/organization-permissions"
import { toast } from "@workspace/ui/components/toast"

/**
 * The current user's role in the given store, or null when they aren't a member.
 * The result is keyed by organization id, so changing the id counts as loading
 * again and a stale role is never used for the wrong store. A null id (a component
 * shared with the platform's pages) skips the request: no role, nothing loading.
 */
export function useMemberRole(organizationId: string | null) {
  const [result, setResult] = useState<{ organizationId: string; role: OrgRole | null } | null>(null)

  useEffect(() => {
    if (!organizationId) return
    let isCurrent = true

    const fail = (message: string) => {
      if (!isCurrent) return
      toast.add({ title: "Unable to check store permissions", description: message, type: "error" })
      setResult({ organizationId, role: null })
    }

    consoleAuthClient.organization
      .getActiveMemberRole({ query: { organizationId } })
      .then(({ data, error }) => {
        if (error) return fail(error.message ?? "An unexpected error occurred.")
        if (isCurrent) setResult({ organizationId, role: (data?.role as OrgRole | undefined) ?? null })
      })
      .catch((error: unknown) => fail(error instanceof Error ? error.message : "An unexpected error occurred."))

    return () => {
      isCurrent = false
    }
  }, [organizationId])

  if (!organizationId) return { role: null, isLoading: false }
  const current = result?.organizationId === organizationId ? result : null
  return { role: current?.role ?? null, isLoading: current === null }
}
