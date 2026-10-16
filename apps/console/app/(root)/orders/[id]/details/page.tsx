import { requireSystemPermission } from "@/lib/auth-guard"

export default async function DetailsPage() {
  await requireSystemPermission({ order: ["read"] })
  return <div>page</div>
}
