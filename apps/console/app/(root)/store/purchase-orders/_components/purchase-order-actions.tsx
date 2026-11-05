"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { Paperclip, X } from "lucide-react"
import type { z } from "zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { NumberInputField, SwitchField, TextareaField } from "@workspace/forms"
import { formatCurrency } from "@workspace/utils/currency"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import FormDialog from "@/components/form-dialog"
import { checkPickedFiles } from "@/components/purchase-orders/purchase-order-files-card"
import { useMemberRole } from "@/hooks/use-member-role"
import { cancelPurchaseOrderAction, deletePurchaseOrderAction, markPurchaseOrderedAction, receivePurchaseOrderAction } from "@/lib/actions/purchase-order.actions"
import { formatFileSize, MAX_FILES_PER_PURCHASE_ORDER, PURCHASE_ORDER_FILE_ACCEPT, uploadPurchaseOrderFiles } from "@/lib/purchase-order-file-rules"
import { cancelTarget, isEditablePurchaseOrder, isOpenPurchaseOrder } from "@/lib/purchase-order-status"
import { cancelPurchaseOrderFormSchema, receivePurchaseOrderFormSchema } from "@/lib/schemas/purchase-order.schemas"
import type { PurchaseOrderDetails } from "@/types"

// The status card's buttons. Fetches the store role once and shows what it allows; every action checks again.

// The purchase order changed under the page: show it as it is now
const REFRESH_CODES = ["STATUS_CHANGED", "RECEIPTS_CHANGED", "CONFLICT", "NOT_FOUND"]

type ReceiveFormInput = z.input<typeof receivePurchaseOrderFormSchema>
type ReceiveFormOutput = z.output<typeof receivePurchaseOrderFormSchema>

const label = (line: PurchaseOrderDetails["lines"][number]) => (line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName)

interface PurchaseOrderActionsProps {
  storeId: string
  order: PurchaseOrderDetails
}

export default function PurchaseOrderActions({ storeId, order }: PurchaseOrderActionsProps) {
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />
  const can = (action: "update" | "receive" | "cancel") => role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { purchaseOrder: [action] } })
  // Buy prices are part of the listing
  const canSetBuyPrices = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { listing: ["update"] } })

  const isDraft = order.status === PurchaseOrderStatus.DRAFT
  const isOpen = isOpenPurchaseOrder(order.status)
  const buttons = [
    isDraft && can("update") && <MarkOrdered key="order" storeId={storeId} order={order} />,
    isOpen && can("receive") && <ReceiveItems key="receive" storeId={storeId} order={order} canSetBuyPrices={canSetBuyPrices} />,
    isEditablePurchaseOrder(order.status) && can("update") && (
      <Link key="edit" href={`/store/purchase-orders/${order.id}/edit`} className={buttonVariants({ variant: "outline" })}>
        Edit
      </Link>
    ),
    isOpen && can("cancel") && <CancelOrder key="cancel" storeId={storeId} order={order} />,
    isDraft && can("cancel") && <DeleteDraft key="delete" storeId={storeId} order={order} />,
  ].filter(Boolean)

  if (!buttons.length) {
    if (!isEditablePurchaseOrder(order.status)) return null
    return <p className="text-sm text-muted-foreground">Your role in this store can&apos;t change this purchase order.</p>
  }
  return <div className="grid gap-2">{buttons}</div>
}

// Sends a draft: its items show as incoming on the listings
function MarkOrdered({ storeId, order }: PurchaseOrderActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const response = await markPurchaseOrderedAction({ storeId, id: order.id })
      if (!response.success) {
        toast.add({ title: "Unable to mark it as ordered", description: response.error, type: "error" })
        if (response.code && REFRESH_CODES.includes(response.code)) router.refresh()
        return
      }
      toast.add({ title: "Marked as ordered", description: `${order.reference}'s items now show as incoming stock.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-1">
      <Button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? <Spinner /> : "Mark as ordered"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {order.currency === Currency.GHS ? "Once it's sent to the supplier. Costs are converted to USD at today's rate." : "Once it's sent to the supplier."}
      </p>
    </div>
  )
}

// Files to add with the delivery, uploaded once it's saved
function AttachFiles({ files, setFiles, room, disabled }: { files: File[]; setFiles: (files: File[]) => void; room: number; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  if (room <= 0) return null

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        multiple
        accept={PURCHASE_ORDER_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const picked = [...files, ...Array.from(event.target.files ?? [])]
          event.target.value = ""
          const problem = checkPickedFiles(picked, room)
          if (problem) toast.add({ title: "Unable to attach the files", description: problem, type: "error" })
          else setFiles(picked)
        }}
      />
      {files.length > 0 && (
        <ul className="grid gap-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Don't attach ${file.name}`} disabled={disabled} onClick={() => setFiles(files.filter((_, i) => i !== index))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={disabled} onClick={() => input.current?.click()}>
        <Paperclip />
        Attach a delivery note or invoice
      </Button>
    </div>
  )
}

function ReceiveFields({
  form,
  isPending,
  lines,
  canSetBuyPrices,
  files,
  setFiles,
  room,
}: {
  form: UseFormReturn<ReceiveFormInput, unknown, ReceiveFormOutput>
  isPending: boolean
  lines: PurchaseOrderDetails["lines"]
  canSetBuyPrices: boolean
  files: File[]
  setFiles: (files: File[]) => void
  room: number
}) {
  const items = useWatch({ control: form.control, name: "items" })
  const count = (items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return (
    <>
      <div className="grid gap-3">
        {lines.map((line, index) => {
          const left = line.quantityOrdered - line.quantityReceived
          return (
            <div key={line.id} className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_8rem]">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{label(line)}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    line.sku,
                    `${left} of ${line.quantityOrdered} to come`,
                    line.stock === null ? "Stock not tracked" : `${line.stock} in stock`,
                    canSetBuyPrices && line.landedCostUsd && `landed cost ${formatCurrency(line.landedCostUsd, "USD", "en-US")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <NumberInputField control={form.control} name={`items.${index}.quantity`} step={1} min={0} max={left} disabled={isPending} aria-label={`How many of ${label(line)} came in`} />
            </div>
          )
        })}
      </div>
      {canSetBuyPrices && (
        <SwitchField
          control={form.control}
          label="Update buy prices"
          name="updateBuyPrices"
          description="Set each listing's buy price to its landed cost: its cost plus its share of shipping and import costs"
          disabled={isPending}
          variant="card"
        />
      )}
      <TextareaField control={form.control} label="Note" name="note" placeholder="Optional: a delivery note number, damaged boxes…" disabled={isPending} />
      <AttachFiles files={files} setFiles={setFiles} room={room} disabled={isPending} />
      <p className="text-sm text-muted-foreground">
        {count === 1 ? "1 item will be added to stock." : `${count} items will be added to stock.`} Items that don&apos;t track stock are only counted as received.
      </p>
    </>
  )
}

function ReceiveItems({ storeId, order, canSetBuyPrices }: PurchaseOrderActionsProps & { canSetBuyPrices: boolean }) {
  const lines = order.lines.filter((line) => line.quantityReceived < line.quantityOrdered)
  const [files, setFiles] = useState<File[]>([])

  const receive = async (values: ReceiveFormOutput) => {
    const response = await receivePurchaseOrderAction({ ...values, updateBuyPrices: canSetBuyPrices && values.updateBuyPrices, storeId, id: order.id, receiptCount: order.receipts.length })
    if (response.success && files.length) {
      // The delivery is saved either way: say so, and where to add the files again
      const upload = await uploadPurchaseOrderFiles(order.id, files, response.data.receiptId)
      if (!upload.ok) toast.add({ title: "The files weren't attached", description: `${upload.error} The delivery was recorded: add them on the Files card.`, type: "error" })
      else setFiles([])
    }
    return response
  }

  return (
    <FormDialog
      trigger={<Button type="button">Receive items</Button>}
      title="Receive items"
      description="Lower any that came in short."
      submitLabel="Receive"
      failureTitle="Unable to receive the items"
      refreshOn={REFRESH_CODES}
      className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      schema={receivePurchaseOrderFormSchema}
      values={{
        items: lines.map((line) => ({ purchaseOrderItemId: line.id, quantity: line.quantityOrdered - line.quantityReceived })),
        updateBuyPrices: canSetBuyPrices,
        note: "",
      }}
      save={receive}
      success={(values) => {
        const count = values.items.reduce((sum, item) => sum + item.quantity, 0)
        return { title: "Items received", description: count === 1 ? "1 item has been received." : `${count} items have been received.` }
      }}
    >
      {(form, isPending) => (
        <ReceiveFields form={form} isPending={isPending} lines={lines} canSetBuyPrices={canSetBuyPrices} files={files} setFiles={setFiles} room={MAX_FILES_PER_PURCHASE_ORDER - order.files.length} />
      )}
    </FormDialog>
  )
}

// Cancels an order nothing has arrived on, or closes one that is partly here
function CancelOrder({ storeId, order }: PurchaseOrderActionsProps) {
  const closes = cancelTarget(order.status) === PurchaseOrderStatus.CLOSED

  return (
    <FormDialog
      trigger={
        <Button type="button" variant="destructive">
          {closes ? "Close" : "Cancel order"}
        </Button>
      }
      title={closes ? "Close purchase order" : "Cancel purchase order"}
      description={closes ? "The rest stops showing as incoming." : "Its items stop showing as incoming."}
      submitLabel={closes ? "Close" : "Cancel order"}
      failureTitle={closes ? "Unable to close the purchase order" : "Unable to cancel the purchase order"}
      refreshOn={REFRESH_CODES}
      destructive
      schema={cancelPurchaseOrderFormSchema}
      values={{ reason: "" }}
      save={(values) => cancelPurchaseOrderAction({ ...values, storeId, id: order.id, currentStatus: order.status })}
      success={() => ({ title: closes ? "Purchase order closed" : "Purchase order cancelled", description: `${order.reference} is ${closes ? "closed" : "cancelled"}.` })}
    >
      {(form, isPending) => <TextareaField control={form.control} label="Reason" name="reason" placeholder={closes ? "The supplier ran out of the rest" : "Ordered elsewhere"} disabled={isPending} />}
    </FormDialog>
  )
}

// Only a draft is deleted; an order that went out is cancelled instead
function DeleteDraft({ storeId, order }: PurchaseOrderActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deletePurchaseOrderAction({ storeId, id: order.id })
      if (!response.success) {
        toast.add({ title: "Unable to delete the draft", description: response.error, type: "error" })
        if (response.code && REFRESH_CODES.includes(response.code)) {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ title: "Draft deleted", description: `${order.reference} has been deleted.`, type: "success" })
      router.push("/store/purchase-orders")
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive">
            Delete draft
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`This can't be undone. ${order.reference} will be permanently deleted.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
