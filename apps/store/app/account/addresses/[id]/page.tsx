import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { z } from "zod"

import { AddressForm } from "@/components/account/address-form"
import { getSavedAddress } from "@/lib/addresses"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Edit address", robots: { index: false } }

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireCustomer(`/account/addresses/${id}`)
  // Only the customer's own: another account's address is as missing as one that doesn't exist
  const address = z.uuid().safeParse(id).success ? await getSavedAddress(session.user.id, id) : null
  if (!address) notFound()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit address</CardTitle>
      </CardHeader>
      <CardContent>
        <AddressForm
          id={address.id}
          initial={{ name: address.name, phone: address.phone, line1: address.line1, line2: address.line2 ?? "", region: address.region, town: address.town, isDefault: address.isDefault }}
          isOnlyDefault={address.isDefault}
        />
      </CardContent>
    </Card>
  )
}
