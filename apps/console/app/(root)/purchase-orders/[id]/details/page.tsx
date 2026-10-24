import type { Metadata } from "next"
import { notFound } from "next/navigation"
import z from "zod"
import { buttonVariants } from "@workspace/ui/components/button"
import PurchaseOrderView from "@/components/purchase-orders/purchase-order-view"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { getPurchaseOrderDetails } from "@/lib/data/purchase-orders.data"

export const metadata: Metadata = {
  title: "Purchase Order",
}

type PurchaseOrderDetailsPageProps = {
  params: Promise<{ id: string }>
}

// Any store's purchase order, read only. Platform staff belong to every store, so they can act on it in its workspace.
export default async function PlatformPurchaseOrderDetailsPage({ params }: PurchaseOrderDetailsPageProps) {
  await requireConsoleAdmin()

  const { id } = await params
  // PurchaseOrder.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getPurchaseOrderDetails(null, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const order = response.data
  return (
    <PurchaseOrderView
      order={order}
      backTo="/purchase-orders"
      showStore
      statusContent={
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{`${order.store.name} manages this order in its workspace.`}</p>
          {/* A full page load: ?workspace= switches the session to the store (proxy.ts), and the sidebar follows */}
          <a href={`/store/purchase-orders/${order.id}/details?workspace=${order.store.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {`Open in ${order.store.name}`}
          </a>
        </div>
      }
    />
  )
}
