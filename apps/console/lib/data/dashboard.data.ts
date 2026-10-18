import "server-only"

import type { DashboardPeriod, PlatformDashboard, StoreDashboard } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { DataResponse } from "@workspace/contracts"
import { hasStorePermission } from "@/lib/auth-guard"
import { getPlatformStats, getStoreStats, periodStart } from "@/lib/dashboard-stats"

export const getStoreDashboard = async (storeId: string, period: DashboardPeriod): Promise<DataResponse<StoreDashboard>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await hasStorePermission(session.user.id, storeId, { order: ["read"] }))) return { success: false, error: "Forbidden" }

    return { success: true, data: await getStoreStats(prisma, storeId, periodStart(period)) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getPlatformDashboard = async (period: DashboardPeriod): Promise<DataResponse<PlatformDashboard>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session) return { success: false, error: "Unauthorized" }
    if (!hasSystemPermission(session.user.role, { order: ["read"] })) return { success: false, error: "Forbidden" }

    return { success: true, data: await getPlatformStats(prisma, periodStart(period)) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
