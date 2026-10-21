import type { Metadata } from "next"
import Link from "next/link"
import { MapPin, Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

import { AddressActions } from "@/components/account/address-actions"
import { getSavedAddresses, MAX_SAVED_ADDRESSES } from "@/lib/addresses"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Addresses", robots: { index: false } }

export default async function AddressesPage() {
  const session = await requireCustomer("/account/addresses")
  const addresses = await getSavedAddresses(session.user.id)
  const canAdd = addresses.length < MAX_SAVED_ADDRESSES

  if (addresses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <MapPin className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No saved addresses</p>
          <p className="max-w-sm text-sm text-muted-foreground">Save an address and checkout fills it in for you. You can also save one when you place an order.</p>
          <Button render={<Link href="/account/addresses/new" />} className="mt-2">
            <Plus data-icon="inline-start" aria-hidden />
            Add an address
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Checkout fills in your default address. You can choose another there.</p>
        {canAdd ? (
          <Button render={<Link href="/account/addresses/new" />} size="sm">
            <Plus data-icon="inline-start" aria-hidden />
            Add an address
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">You can save up to {MAX_SAVED_ADDRESSES} addresses.</p>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{address.name}</p>
                  {address.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
                <div className="flex-1 text-muted-foreground">
                  <p>{address.line1}</p>
                  {address.line2 && <p>{address.line2}</p>}
                  <p>
                    {address.town}, {address.region}
                  </p>
                  <p>{address.phone}</p>
                </div>
                <AddressActions id={address.id} isDefault={address.isDefault} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
