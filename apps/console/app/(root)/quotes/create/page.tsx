import type { Metadata } from "next"
import { getStringParam } from "@workspace/utils/search-params"
import NewQuotation from "@/components/quotes/new-quotation"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "New Quotation",
}

type CreateQuotePageProps = {
  // ?from= a quotation to copy
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CreateQuotePage({ searchParams }: CreateQuotePageProps) {
  await requireSystemPermission({ order: ["create"] })
  return <NewQuotation storeId={null} from={getStringParam((await searchParams).from)} canChooseDiscount />
}
