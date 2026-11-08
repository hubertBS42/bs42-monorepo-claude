import type { Metadata } from "next"
import { getEnumParam, getPositiveIntegerParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreCollections, MAX_COLLECTIONS_PAGE_SIZE } from "@/lib/data/collections.data"
import CollectionsTable from "./_components/collections-table"

export const metadata: Metadata = {
  title: "Collections",
}

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

// Every role: whoever is at the counter hands orders over
export default async function CollectionsPage({ searchParams }: Props) {
  const { storeId } = await requireActiveStoreMember()
  const params = await searchParams
  const result = await getStoreCollections(storeId, {
    view: getEnumParam(params.view, ["collected"]) ?? "open",
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 25, MAX_COLLECTIONS_PAGE_SIZE),
  })
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Collections</h1>
        <p className="text-sm text-muted-foreground">Orders customers collect at this branch, from any branch&apos;s stock.</p>
      </div>
      <CollectionsTable data={result.data} />
    </div>
  )
}
