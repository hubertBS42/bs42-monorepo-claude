import type { Metadata } from "next"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import { capitalizeWord } from "@workspace/utils/text"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreById } from "@/lib/data/stores.data"
import StoreActions from "../_components/store-actions"

export const metadata: Metadata = {
  title: "Store Details",
}

const StoreOverviewPage = async () => {
  const { storeId } = await requireActiveStoreMember()

  const response = await getStoreById(storeId)
  if (!response.success) throw new Error(response.error)
  const store = response.data

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Store Details</h1>
        <p className="text-sm text-muted-foreground">This store&apos;s details, and leaving or deleting it.</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{store.name}</CardTitle>
            <CardDescription>General information about this store</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{store.name}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Slug</p>
                <p className="font-mono text-sm font-medium">{store.slug}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <div>
                  <Badge variant={store.status === "ACTIVE" ? "success" : store.status === "SUSPENDED" ? "destructive" : "outline"}>{capitalizeWord(store.status.toLowerCase())}</Badge>
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Created on</p>
                <p className="text-sm font-medium">{formatDate(store.createdAt, "LLL dd, y")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <StoreActions store={store} />
      </div>
    </div>
  )
}

export default StoreOverviewPage
