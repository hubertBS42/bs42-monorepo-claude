import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import BackButton from "@/components/back-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getTransferDestinations } from "@/lib/data/stock-transfers.data"
import { TRANSFER_ROLES } from "@/lib/stock-transfer-status"
import TransferForm from "./_components/transfer-form"

export const metadata: Metadata = {
  title: "Send Stock",
}

export default async function NewTransferPage() {
  const { session, storeId, role } = await requireActiveStoreMember()
  if (!TRANSFER_ROLES.includes(role)) redirect("/forbidden")

  const destinations = await getTransferDestinations(session.user.id, storeId)
  if (destinations.length === 0) {
    return (
      <div className="flex flex-col gap-y-6">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-xl font-bold md:text-2xl">Send Stock</h1>
          <BackButton link="/store/transfers" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No other store to send to</CardTitle>
            <CardDescription>You need to own or admin another store to transfer stock.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    )
  }

  return <TransferForm storeId={storeId} destinations={destinations} />
}
