"use client"

import { InstallationStatus, type OrderStatus, type PaymentMethod, type PaymentStatus } from "@workspace/db/enums"
import { DateField, NumberInputField, SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import FormDialog from "@/components/form-dialog"
import { InstallationStatusBadge } from "@/components/order-badges"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { cancelInstallationAction, updateInstallationAction } from "@/lib/actions/order.actions"
import { installationBlockedReason, isPaid, nextInstallationStatuses, PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { cancelInstallationFormSchema, installationFormSchema } from "@/lib/schemas/order.schemas"
import type { OrderInstallation } from "@/types"

// An order's installation. The platform's installers do it, so only the platform's pages (storeId null) change it:
// booking a day (or another), marking it done, and cancelling it with a refund. A store's page shows where it stands.

const ghs = (amount: string | number) => formatCurrency(String(amount), "GHS", "en-GH")
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value }))
// What the dialogs refresh on: the order changed under the page
const REFRESH_ON = ["INSTALLATION_CHANGED", "REFUNDS_CHANGED", "NOT_PAID", "NOT_ALLOWED"]

// The booked day as a Date in the browser's zone (the date field's value), and back
const toLocalDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year!, month! - 1, date)
}
const toDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

interface InstallationCardProps {
  // Null on the platform's pages, which manage it; a store's page only shows it
  storeId: string | null
  orderId: string
  installation: OrderInstallation
  order: { status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod }
  // What the page showed as refunded so far, and what's left (null where the viewer doesn't see the order's money)
  refundedGhs: string | null
  refundableGhs: string | null
}

export default function InstallationCard({ storeId, orderId, installation, order, refundedGhs, refundableGhs }: InstallationCardProps) {
  const { status, date } = installation
  const booked = date ? formatDate(toLocalDate(date), "EEE d MMM yyyy") : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Installation
          <InstallationStatusBadge status={status} />
        </CardTitle>
        <CardDescription>
          {status === InstallationStatus.BOOKED && booked
            ? `Booked for ${booked}.`
            : status === InstallationStatus.DONE
              ? "The installers have been."
              : status === InstallationStatus.CANCELLED
                ? "Cancelled."
                : "Call the customer to arrange a day."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {storeId ? (
          <p className="text-sm text-muted-foreground">The platform&apos;s installers arrange it with the customer.</p>
        ) : (
          <InstallationControls orderId={orderId} installation={installation} order={order} refundedGhs={refundedGhs ?? "0"} refundableGhs={refundableGhs ?? "0"} />
        )}
      </CardContent>
    </Card>
  )
}

function InstallationControls({ orderId, installation, order, refundedGhs, refundableGhs }: Omit<InstallationCardProps, "storeId"> & { refundedGhs: string; refundableGhs: string }) {
  const { canUpdate, isLoading } = useCanUpdateOrders(null)
  const { canUpdate: canRefund, isLoading: isRefundLoading } = useCanUpdateOrders(null, "refund")

  const next = nextInstallationStatuses(installation.status)
  if (next.length === 0) return <p className="text-sm text-muted-foreground">Nothing left to do.</p>
  if (isLoading || isRefundLoading) return <Skeleton className="h-9 rounded-md" />
  if (!canUpdate) return <p className="text-sm text-muted-foreground">Your role can&apos;t arrange installation.</p>

  const blocked = installationBlockedReason(order)
  const target = { orderId, currentStatus: installation.status }
  // What cancelling refunds: the installation not yet brought back, up to what's left on a paid order
  const suggested = isPaid(order.paymentStatus) ? Math.min(Number(installation.leftGhs), Number(refundableGhs)) : 0
  const isBooked = installation.status === InstallationStatus.BOOKED

  return (
    <div className="grid gap-2">
      {blocked ? (
        <p className="text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <>
          <FormDialog
            trigger={
              <Button type="button" variant={isBooked ? "outline" : "default"}>
                {isBooked ? "Move to another day" : "Book a day"}
              </Button>
            }
            title={isBooked ? "Move the installation" : "Book the installation"}
            description="The customer is emailed the day and your note."
            submitLabel="Book"
            failureTitle="Unable to book the installation"
            refreshOn={REFRESH_ON}
            schema={installationFormSchema}
            values={{ status: InstallationStatus.BOOKED, date: installation.date ? toLocalDate(installation.date) : null, note: "" }}
            save={(values) => updateInstallationAction({ ...target, status: InstallationStatus.BOOKED, date: values.date ? toDay(values.date) : null, note: values.note })}
            success={(values) => ({ title: "Installation booked", description: values.date ? `For ${formatDate(values.date, "EEE d MMM yyyy")}.` : "" })}
          >
            {(form, isPending) => (
              <>
                <DateField control={form.control} name="date" label="Day" clearable={false} disabled={isPending} />
                <TextareaField control={form.control} name="note" label="Note for the customer (optional)" placeholder="e.g. The installer will call the day before" disabled={isPending} />
              </>
            )}
          </FormDialog>

          {isBooked && (
            <FormDialog
              trigger={
                <Button type="button" variant="outline">
                  Mark as done
                </Button>
              }
              title="Mark the installation as done"
              description="Once it's done, returned items no longer suggest refunding their installation."
              submitLabel="Mark as done"
              failureTitle="Unable to update the installation"
              refreshOn={REFRESH_ON}
              schema={installationFormSchema}
              values={{ status: InstallationStatus.DONE, date: null, note: "" }}
              save={(values) => updateInstallationAction({ ...target, status: InstallationStatus.DONE, date: null, note: values.note })}
              success={() => ({ title: "Installation done", description: "Recorded on the order's timeline." })}
            >
              {(form, isPending) => <TextareaField control={form.control} name="note" label="Note (optional)" placeholder="For the timeline" disabled={isPending} />}
            </FormDialog>
          )}
        </>
      )}

      {canRefund ? (
        <FormDialog
          trigger={
            <Button type="button" variant="destructive">
              Cancel installation
            </Button>
          }
          title="Cancel the installation"
          description={`The order stays as it is. ${suggested > 0 ? `Its installation cost the customer ${ghs(suggested)}, refunded unless you change it.` : "There's nothing to refund."}`}
          submitLabel="Cancel installation"
          failureTitle="Unable to cancel the installation"
          refreshOn={REFRESH_ON}
          destructive
          schema={cancelInstallationFormSchema}
          values={{ amountGhs: suggested, method: order.paymentMethod, reason: "" }}
          save={(values) => cancelInstallationAction({ ...values, ...target, refundedGhs })}
          success={(values) => ({ title: "Installation cancelled", description: values.amountGhs > 0 ? `${ghs(values.amountGhs)} refunded.` : "Nothing was refunded." })}
        >
          {(form, isPending) => (
            <>
              <NumberInputField control={form.control} label="Refund" name="amountGhs" step={0.01} min={0} max={Number(refundableGhs)} prependText="GH₵" disabled={isPending} />
              <SelectField control={form.control} label="Given back by" name="method" options={methodOptions} disabled={isPending} />
              <TextareaField control={form.control} label="Reason" name="reason" placeholder="The customer is told this" disabled={isPending} />
            </>
          )}
        </FormDialog>
      ) : (
        <p className="text-sm text-muted-foreground">Only superAdmins can cancel installation, as it refunds the customer.</p>
      )}
    </div>
  )
}
