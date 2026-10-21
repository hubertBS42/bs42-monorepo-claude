import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { prisma } from "@workspace/db"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { AddressForm } from "@/components/account/address-form"
import { MAX_SAVED_ADDRESSES } from "@/lib/addresses"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Add an address", robots: { index: false } }

export default async function NewAddressPage() {
  const session = await requireCustomer("/account/addresses/new")
  const [count, user] = await Promise.all([
    prisma.address.count({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true } }),
  ])
  if (count >= MAX_SAVED_ADDRESSES) redirect("/account/addresses")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an address</CardTitle>
      </CardHeader>
      <CardContent>
        {/* The first address is the default whatever the switch says */}
        <AddressForm initial={{ name: user?.name ?? "", phone: user?.phone ?? "", line1: "", line2: "", region: "", town: "", isDefault: count === 0 }} isOnlyDefault={count === 0} />
      </CardContent>
    </Card>
  )
}
