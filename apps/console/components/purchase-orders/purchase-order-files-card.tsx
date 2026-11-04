"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, FileImage, FileText, Paperclip, Upload, X } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
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
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { useMemberRole } from "@/hooks/use-member-role"
import { removePurchaseOrderFileAction } from "@/lib/actions/purchase-order.actions"
import {
  fileProblem,
  formatFileSize,
  MAX_FILES_PER_PURCHASE_ORDER,
  MAX_FILES_PER_UPLOAD,
  PURCHASE_ORDER_FILE_ACCEPT,
  uploadPurchaseOrderFiles,
} from "@/lib/purchase-order-file-rules"
import type { PurchaseOrderDetails, PurchaseOrderFileItem } from "@/types"


// Checks picked files against the rules, naming the first that breaks one
export function checkPickedFiles(files: File[], room: number): string | null {
  if (files.length > Math.min(room, MAX_FILES_PER_UPLOAD)) {
    return room < MAX_FILES_PER_UPLOAD ? `This order has room for ${room} more ${room === 1 ? "file" : "files"}.` : `Add up to ${MAX_FILES_PER_UPLOAD} files at a time.`
  }
  for (const file of files) {
    const problem = fileProblem(file)
    if (problem) return problem
  }
  return null
}

function FileRow({ file, storeId, orderId, deliveredAt, canRemove }: { file: PurchaseOrderFileItem; storeId: string | null; orderId: string; deliveredAt: Date | null; canRemove: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const Icon = file.contentType === "application/pdf" ? FileText : FileImage

  const remove = () =>
    startTransition(async () => {
      if (!storeId) return
      const response = await removePurchaseOrderFileAction({ storeId, id: orderId, fileId: file.id })
      // NOT_FOUND: someone else removed it first, which is what was wanted
      if (!response.success && response.code !== "NOT_FOUND") toast.add({ title: "Unable to remove the file", description: response.error, type: "error" })
      else toast.add({ title: "File removed", description: `${file.name} has been removed.`, type: "success" })
      setIsOpen(false)
      router.refresh()
    })

  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="grid min-w-0 flex-1">
        {/* The route checks the reader belongs to the store; a new tab keeps the order's page open */}
        <a href={file.href} target="_blank" rel="noopener" className="truncate text-sm font-medium underline-offset-4 hover:underline">
          {file.name}
        </a>
        {/* Wraps rather than truncates: the card sits in a narrow column, and who added it matters */}
        <span className="text-xs text-muted-foreground">
          {[formatFileSize(file.size), formatDate(file.createdAt, "MMM d, yyyy"), file.uploadedBy, deliveredAt && `with the delivery of ${formatDate(deliveredAt, "MMM d")}`].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="flex shrink-0 gap-1">
        <a href={`${file.href}?download=1`} aria-label={`Download ${file.name}`} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">
          <Download className="size-4" />
        </a>
        {canRemove && (
          <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`}>
                  <X />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this file?</AlertDialogTitle>
                <AlertDialogDescription>{`${file.name} will be removed from the purchase order. This can't be undone.`}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(event) => {
                    event.preventDefault()
                    remove()
                  }}
                  disabled={isPending}
                >
                  {isPending ? <Spinner /> : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </li>
  )
}

function AddFiles({ orderId, room }: { orderId: string; room: number }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const upload = async (files: File[]) => {
    const problem = checkPickedFiles(files, room)
    if (problem) {
      toast.add({ title: "Unable to add the files", description: problem, type: "error" })
      return
    }
    setIsUploading(true)
    const result = await uploadPurchaseOrderFiles(orderId, files)
    setIsUploading(false)
    if (!result.ok) toast.add({ title: "Unable to add the files", description: result.error, type: "error" })
    else toast.add({ title: files.length === 1 ? "File added" : "Files added", description: files.length === 1 ? files[0]!.name : `${files.length} files were added.`, type: "success" })
    router.refresh()
  }

  if (room <= 0) return <p className="text-xs text-muted-foreground">{`An order holds at most ${MAX_FILES_PER_PURCHASE_ORDER} files. Remove one to add another.`}</p>
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={PURCHASE_ORDER_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // Cleared, so picking the same file again still fires a change
          event.target.value = ""
          if (files.length) void upload(files)
        }}
      />
      <Button type="button" variant="outline" disabled={isUploading} onClick={() => input.current?.click()}>
        {isUploading ? <Spinner /> : <Upload />}
        {isUploading ? "Uploading…" : "Add files"}
      </Button>
    </>
  )
}

interface PurchaseOrderFilesCardProps {
  order: PurchaseOrderDetails
  // The store's id on its own page; null on the platform's read-only view
  storeId: string | null
}

// Invoices, receipts and delivery notes. Members add them; owners and admins remove any, others their own.
export default function PurchaseOrderFilesCard({ order, storeId }: PurchaseOrderFilesCardProps) {
  const { data: session } = consoleAuthClient.useSession()
  const { role, isLoading } = useMemberRole(storeId)
  const can = (action: "receive" | "update") => !!storeId && role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { purchaseOrder: [action] } })
  const canAdd = can("receive")
  const canRemoveAny = can("update")
  const deliveries = new Map(order.receipts.map((receipt) => [receipt.id, receipt.createdAt]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Files
          <InfoTip about="Files">{`PDFs or photos (JPEG, PNG, WebP) up to 10 MB each, at most ${MAX_FILES_PER_PURCHASE_ORDER} per order. They're private: only this store's team can open them.`}</InfoTip>
        </CardTitle>
        <CardDescription>Invoices, receipts and delivery notes for this order.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {order.files.length > 0 ? (
          <ul className="grid divide-y">
            {order.files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                storeId={storeId}
                orderId={order.id}
                deliveredAt={file.receiptId ? (deliveries.get(file.receiptId) ?? null) : null}
                canRemove={canAdd && (canRemoveAny || file.uploadedById === session?.user.id)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Paperclip} title="No files yet" description={storeId ? "Add the supplier's invoice or a delivery note." : "The store hasn't added any."} />
        )}
        {storeId && (isLoading ? <Skeleton className="h-9 rounded-md" /> : canAdd && <AddFiles orderId={order.id} room={MAX_FILES_PER_PURCHASE_ORDER - order.files.length} />)}
      </CardContent>
    </Card>
  )
}
