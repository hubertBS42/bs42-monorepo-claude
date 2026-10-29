"use client"

import { createContext, useContext, type ReactNode } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"

export type ShellUser = { id: string; name: string; email: string; image: string | null; role: string | null }
export type ShellOrganization = { id: string; name: string; slug: string; logo: string | null }
export type ShellData = { user: ShellUser; activeOrganizationId: string | null; organizations: ShellOrganization[] } | null

const ShellDataContext = createContext<ShellData>(null)

// The (root) layout's data for the sidebar (lib/data/shell.data.ts)
export function ShellDataProvider({ value, children }: { value: ShellData; children: ReactNode }) {
  return <ShellDataContext.Provider value={value}>{children}</ShellDataContext.Provider>
}

// The signed-in user and active workspace: Better Auth's, once the browser has fetched them, so changes (a switch, a
// new name) show; until then the server's, so the sidebar renders complete on the first paint. Pending only outside
// the shell, where there's no server data.
export function useShellSession() {
  const initial = useContext(ShellDataContext)
  const { data, isPending, error } = consoleAuthClient.useSession()

  if (!isPending) {
    if (!data) return { user: null, activeOrganizationId: null, isPending: false, error }
    const { id, name, email, image, role } = data.user
    return { user: { id, name, email, image: image ?? null, role: role ?? null }, activeOrganizationId: data.session.activeOrganizationId ?? null, isPending: false, error }
  }
  return { user: initial?.user ?? null, activeOrganizationId: initial?.activeOrganizationId ?? null, isPending: !initial, error: null }
}

// The workspaces the user can switch to, the same way
export function useShellOrganizations() {
  const initial = useContext(ShellDataContext)
  const { data, isPending, error } = consoleAuthClient.useListOrganizations()

  if (!isPending) {
    const organizations: ShellOrganization[] = (data ?? []).map(({ id, name, slug, logo }) => ({ id, name, slug, logo: logo ?? null }))
    return { organizations, isPending: false, error }
  }
  return { organizations: initial?.organizations ?? [], isPending: !initial, error: null }
}
