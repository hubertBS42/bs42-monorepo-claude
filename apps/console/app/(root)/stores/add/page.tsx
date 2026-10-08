import { Metadata } from "next"
import AddStoreForm from "./_components/add-store-form"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Store",
}

export default async function AddStorePage() {
  await requireSystemPermission({ organization: ["create"] })
  return <AddStoreForm />
}
