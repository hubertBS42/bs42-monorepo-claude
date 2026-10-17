import "server-only"

import { prisma } from "@workspace/db"

// The caller's own sessions that haven't expired. Selects only what the sessions page shows: a session row also holds
// its token, which must never reach a client component.
export const getUserSessions = async (userId: string) => {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })
}

export type UserSession = Awaited<ReturnType<typeof getUserSessions>>[number]
