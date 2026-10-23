"use server"

import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import z from "zod"
import { requireConsoleAccess } from "@/lib/auth-guard"

// The header's bell. Each finds the notification among the user's own, so another user's id does nothing.

export async function markNotificationReadAction(id: string): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { success: false, error: "Invalid notification ID", code: "INVALID" }
  try {
    await prisma.notification.updateMany({ where: { id: parsed.data, userId: user.id, readAt: null }, data: { readAt: new Date() } })
    return { success: true }
  } catch (error) {
    console.error("Could not mark a notification as read:", error)
    return { success: false, error: "Couldn't mark it as read. Please try again." }
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
    return { success: true }
  } catch (error) {
    console.error("Could not mark notifications as read:", error)
    return { success: false, error: "Couldn't mark them as read. Please try again." }
  }
}

export async function dismissNotificationAction(id: string): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { success: false, error: "Invalid notification ID", code: "INVALID" }
  try {
    await prisma.notification.deleteMany({ where: { id: parsed.data, userId: user.id } })
    return { success: true }
  } catch (error) {
    console.error("Could not dismiss a notification:", error)
    return { success: false, error: "Couldn't dismiss it. Please try again." }
  }
}

// Only those already read, so one that arrived since the list was shown stays
export async function clearReadNotificationsAction(): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    await prisma.notification.deleteMany({ where: { userId: user.id, readAt: { not: null } } })
    return { success: true }
  } catch (error) {
    console.error("Could not clear read notifications:", error)
    return { success: false, error: "Couldn't clear them. Please try again." }
  }
}
