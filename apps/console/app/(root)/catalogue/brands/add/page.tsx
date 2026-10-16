import type { Metadata } from "next"
import AddBrandForm from "./_components/add-brand-form"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Brand",
}
export default async function AddBrandPage() {
  await requireSystemPermission({ brand: ["create"] })

  return <AddBrandForm />
}
