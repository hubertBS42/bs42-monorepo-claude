"use client"

import { NumberInputField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import FormDialog from "@/components/form-dialog"
import { useMemberRole } from "@/hooks/use-member-role"
import { cancelStockTransferAction, receiveStockTransferAction } from "@/lib/actions/stock-transfer.actions"
import { cancelStockTransferFormSchema, receiveStockTransferFormSchema, STOCK_TRANSFER_LIMITS } from "@/lib/schemas/stock-transfer.schemas"
import { TRANSFER_ROLES } from "@/lib/stock-transfer-status"
import type { StockTransferDetails } from "@/types"

// What this store can do with a transfer on its way: the receiving store receives it (any role, whoever unpacks it),
// the sending store's owners and admins cancel it. Each refuses STATUS_CHANGED when the other side got there first.

const REFRESH_ON = ["STATUS_CHANGED", "NOT_FOUND", "CONFLICT"]

const itemLabel = (item: StockTransferDetails["items"][number]) => (item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName)

export default function TransferActions({ storeId, transfer }: { storeId: string; transfer: StockTransferDetails }) {
  const { role, isLoading } = useMemberRole(storeId)
  if (isLoading) return <Skeleton className="h-9 rounded-md" />

  if (transfer.direction === "in") {
    return (
      <FormDialog
        trigger={<Button type="button">Receive</Button>}
        title={`Receive ${transfer.reference}`}
        description="Enter what arrived. Anything missing is recorded as lost."
        submitLabel="Receive"
        failureTitle="Unable to receive the transfer"
        refreshOn={REFRESH_ON}
        className="sm:max-w-lg"
        schema={receiveStockTransferFormSchema}
        values={{ items: transfer.items.map((item) => ({ itemId: item.id, quantity: item.quantity })), note: "" }}
        save={(values) => receiveStockTransferAction({ ...values, storeId, transferId: transfer.id })}
        success={(values) => {
          const sent = transfer.items.reduce((sum, item) => sum + item.quantity, 0)
          const arrived = values.items.reduce((sum, item) => sum + item.quantity, 0)
          return { title: "Transfer received", description: arrived === sent ? "Everything was added to this store's stock." : `${arrived} of ${sent} arrived and were added to this store's stock.` }
        }}
      >
        {(form, saving) => (
          <>
            {transfer.items.map((item, index) => (
              <NumberInputField
                key={item.id}
                control={form.control}
                name={`items.${index}.quantity`}
                label={`${itemLabel(item)}: ${item.quantity} sent`}
                step={1}
                min={0}
                max={item.quantity}
                disabled={saving}
              />
            ))}
            <TextareaField control={form.control} label="Note" name="note" placeholder="e.g. One box was damaged" maxLength={STOCK_TRANSFER_LIMITS.notes} disabled={saving} />
          </>
        )}
      </FormDialog>
    )
  }

  if (!role || !TRANSFER_ROLES.includes(role)) return <p className="text-sm text-muted-foreground">Only this store&apos;s owners and admins can cancel it.</p>

  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline">
          Cancel transfer
        </Button>
      }
      title={`Cancel ${transfer.reference}`}
      description={`The stock returns here and ${transfer.toStore.name} is told.`}
      submitLabel="Cancel transfer"
      failureTitle="Unable to cancel the transfer"
      refreshOn={REFRESH_ON}
      destructive
      schema={cancelStockTransferFormSchema}
      values={{ reason: "" }}
      save={(values) => cancelStockTransferAction({ ...values, storeId, transferId: transfer.id })}
      success={() => ({ title: "Transfer cancelled", description: "The stock is back in this store's listings." })}
    >
      {(form, saving) => (
        <TextareaField control={form.control} label="Reason" name="reason" placeholder="e.g. Sent to the wrong store" showCount maxLength={STOCK_TRANSFER_LIMITS.reason} disabled={saving} />
      )}
    </FormDialog>
  )
}
