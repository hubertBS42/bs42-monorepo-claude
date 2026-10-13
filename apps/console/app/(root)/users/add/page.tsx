import { Metadata } from "next"
import AddUserForm from "./_components/add-user-form"
import { getStoresForSelect } from "@/lib/data/stores.data"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add User",
}

export default async function AddUserPage() {
  await requireSystemPermission({ user: ["create"] })
  const response = await getStoresForSelect()
  if (!response.success) throw new Error(response.error)
  return <AddUserForm stores={response.data} />
}
