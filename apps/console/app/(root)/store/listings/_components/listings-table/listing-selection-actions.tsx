"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Star, StarOff } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Status } from "@workspace/db/enums"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useMemberRole } from "@/hooks/use-member-role"
import { setListingsFeaturedAction } from "@/lib/actions/listing.actions"
import type { ListingListItem } from "@/types"
import CreatePurchaseOrderButton from "./create-purchase-order-button"

const countLabel = (count: number) => (count === 1 ? "1 listing" : `${count} listings`)

// For the listings ticked in the table: feature or unfeature them, or start a purchase order with them. Fetches the
// store role once for both; the actions and the create page check again.
export default function ListingSelectionActions({ storeId, listings, clear }: { storeId: string; listings: ListingListItem[]; clear: () => void }) {
  const router = useRouter()
  const { role, isLoading } = useMemberRole(storeId)
  const [isPending, startTransition] = useTransition()

  if (isLoading) return <Skeleton className="h-8 w-72 rounded-md" />

  const canUpdate = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { listing: ["update"] } })
  const toFeature = listings.filter((listing) => !listing.isFeatured)
  const toUnfeature = listings.filter((listing) => listing.isFeatured)

  const setFeatured = (featured: boolean) => {
    const changing = featured ? toFeature : toUnfeature
    // A featured listing customers can't see never reaches the storefront, so say so rather than leave them wondering
    const hidden = featured ? changing.filter((listing) => listing.status !== Status.PUBLISHED || listing.notOnSaleReason).length : 0
    startTransition(async () => {
      const response = await setListingsFeaturedAction({ storeId, listingIds: changing.map((listing) => listing.id), featured })
      if (!response.success) {
        toast.add({ title: `Couldn't ${featured ? "feature" : "unfeature"} them`, description: response.error, type: "error" })
        return
      }
      clear()
      toast.add({
        title: `${countLabel(changing.length)} ${featured ? "featured" : "unfeatured"}`,
        description: hidden ? `${hidden === 1 ? "1 of them isn't" : `${hidden} of them aren't`} on sale, so customers won't see ${hidden === 1 ? "it" : "them"} yet.` : undefined,
        type: "success",
      })
      router.refresh()
    })
  }

  return (
    <>
      {canUpdate ? (
        <>
          {toFeature.length > 0 && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setFeatured(true)}>
              {isPending ? <Spinner /> : <Star />}
              Feature
            </Button>
          )}
          {toUnfeature.length > 0 && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setFeatured(false)}>
              {isPending ? <Spinner /> : <StarOff />}
              Unfeature
            </Button>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Your role in this store can&apos;t change listings.</span>
      )}
      <CreatePurchaseOrderButton role={role} listings={listings} />
    </>
  )
}
