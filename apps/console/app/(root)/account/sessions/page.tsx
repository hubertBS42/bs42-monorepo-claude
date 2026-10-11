import { requireConsoleAccess } from "@/lib/auth-guard"

export default async function SessionsPage() {
  await requireConsoleAccess()
  return <div>page</div>
}
