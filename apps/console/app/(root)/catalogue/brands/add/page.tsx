import type { Metadata } from "next"
import AddBrandForm from "./_components/add-brand-form"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Brand",
}
const AddBrandPage = async () => {
  await requireSystemPermission({ brand: ["create"] })

  return <AddBrandForm />
}

export default AddBrandPage
