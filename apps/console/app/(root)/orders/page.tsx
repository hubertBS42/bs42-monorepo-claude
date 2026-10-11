import { requireConsoleAdmin } from "@/lib/auth-guard"

export default async function OrdersPage() {
  await requireConsoleAdmin()
  return <div>page</div>
}
