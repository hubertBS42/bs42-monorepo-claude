import { requireConsoleAccess } from "@/lib/auth-guard"

export default async function DashboardPage() {
  await requireConsoleAccess()
  return <div>Welcome to the Dashboard</div>
}
