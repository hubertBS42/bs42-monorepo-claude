import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { InstallationStatus } from "@workspace/db/enums"
import { installationBlockedReason, nextInstallationStatuses } from "@workspace/commerce/order-status"
import { returnedUnitsAmount } from "@workspace/commerce/pricing"
import { refundOrder, returnedSoFar, type RefundInput } from "./order-refunds"

// An order's installation, which the platform's staff arrange: booking it for a day (again, to move it), marking it
// done, or cancelling it with a refund of what it cost. In its own module (like order-refunds.ts) so it can be tested
// against the database without a session.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type InstallationErrorCode = "NOT_FOUND" | "INSTALLATION_CHANGED" | "INVALID_TRANSITION" | "NOT_ALLOWED"

export class InstallationError extends Error {
  readonly code: InstallationErrorCode

  constructor(code: InstallationErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

// What the installation of the units not brought back cost the customer, with its tax: what cancelling it refunds.
// A return refunds the installation of the units it brought back (while it isn't done), so they aren't counted twice.
export function installationLeftGhs(lines: { quantity: number; installationTotalGhs: Prisma.Decimal; installationTaxGhs: Prisma.Decimal; returns: { quantity: number }[] }[]) {
  return lines.reduce((sum, line) => {
    const returned = returnedSoFar(line)
    return sum.plus(returnedUnitsAmount(line.installationTotalGhs.plus(line.installationTaxGhs), line.quantity, returned, line.quantity - returned))
  }, new Prisma.Decimal(0))
}

// Locks the order until the transaction ends, so two people can't both change its installation, and checks it's still
// where the page showed it
async function lockInstallation(tx: Tx, orderId: string, from: InstallationStatus, to: InstallationStatus) {
  await tx.$queryRaw`SELECT 1 FROM "order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, paymentStatus: true, installationStatus: true } })
  if (!order?.installationStatus) throw new InstallationError("NOT_FOUND", "This order has no installation.")
  if (order.installationStatus !== from) throw new InstallationError("INSTALLATION_CHANGED", "Someone else changed this installation since the page loaded. Refresh the page to see it.")
  if (!nextInstallationStatuses(from).includes(to)) throw new InstallationError("INVALID_TRANSITION", "The installation can't move to that status from where it is.")
  return order
}

export interface InstallationChange {
  orderId: string
  // The installation status the page showed
  from: InstallationStatus
  to: typeof InstallationStatus.BOOKED | typeof InstallationStatus.DONE
  // The booked day (yyyy-MM-dd), for BOOKED
  date: string | null
  // Told to the customer with a booking
  note: string | null
  changedById: string
}

// Books the installation for a day (or moves it), or marks it done. Only for a paid order that wasn't cancelled.
export async function changeInstallation(tx: Tx, { orderId, from, to, date, note, changedById }: InstallationChange) {
  const order = await lockInstallation(tx, orderId, from, to)
  const blocked = installationBlockedReason(order)
  if (blocked) throw new InstallationError("NOT_ALLOWED", blocked)
  if (to === InstallationStatus.BOOKED && !date) throw new InstallationError("NOT_ALLOWED", "Choose the day the installers will come.")

  // A @db.Date column: midnight UTC of the day
  const day = to === InstallationStatus.BOOKED ? new Date(`${date}T00:00:00Z`) : undefined
  await tx.order.update({ where: { id: orderId }, data: { installationStatus: to, ...(day && { installationDate: day }) } })
  await tx.orderInstallationHistory.create({ data: { orderId, status: to, date: day ?? null, note, changedById } })
}

// Cancels the installation and refunds the amount given (up to what's left on the order), in one transaction. Nothing
// goes back when the amount is 0, e.g. an order that was never paid.
export async function cancelInstallation(tx: Tx, input: RefundInput & { from: InstallationStatus; amountGhs: Prisma.Decimal }) {
  // The refund locks the order and checks the refunded total the page showed
  if (input.amountGhs.gt(0)) await refundOrder(tx, input)
  await lockInstallation(tx, input.orderId, input.from, InstallationStatus.CANCELLED)

  await tx.order.update({ where: { id: input.orderId }, data: { installationStatus: InstallationStatus.CANCELLED } })
  await tx.orderInstallationHistory.create({ data: { orderId: input.orderId, status: InstallationStatus.CANCELLED, note: input.reason, changedById: input.refundedById } })
}
