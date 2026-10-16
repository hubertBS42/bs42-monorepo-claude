import { requireSystemPermission } from "@/lib/auth-guard"

export default async function OrdersPage() {
  await requireSystemPermission({ order: ["read"] })
  return <div>page</div>
}
