import type { Metadata } from "next"
import { hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { getEnumParam } from "@workspace/utils/search-params"
import { getStoreRole, requireConsoleAccess } from "@/lib/auth-guard"
import { DASHBOARD_PERIODS } from "@/types"
import PeriodTabs from "./_components/period-tabs"
import PlatformDashboard from "./_components/platform-dashboard"
import StoreDashboard from "./_components/store-dashboard"

export const metadata: Metadata = {
  title: "Dashboard",
}

type DashboardPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireConsoleAccess()
  const period = getEnumParam((await searchParams).period, DASHBOARD_PERIODS) ?? "7d"

  // The workspace decides which dashboard: a store's when one of the user's stores is active, the platform's for
  // staff in the global workspace
  const activeId = session.session.activeOrganizationId
  const storeRole = activeId ? await getStoreRole(session.user.id, activeId) : null
  const workspace = activeId && storeRole ? "store" : activeId && hasSystemPermission(session.user.role, { order: ["read"] }) ? "platform" : null

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {workspace === "store"
              ? "How this store is doing, and what's waiting."
              : workspace === "platform"
                ? "How every store is doing, and what's waiting."
                : "Choose a store from the switcher to get started."}
          </p>
        </div>
        {workspace && <PeriodTabs period={period} />}
      </div>

      {workspace === "store" && <StoreDashboard storeId={activeId!} period={period} />}
      {workspace === "platform" && <PlatformDashboard period={period} canOpenSettings={hasSystemRole(session.user.role, ["superAdmin"])} />}
    </main>
  )
}
