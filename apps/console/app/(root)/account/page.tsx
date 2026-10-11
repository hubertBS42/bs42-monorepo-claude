import { requireConsoleAccess } from "@/lib/auth-guard"

export default async function AccountPage() {
  await requireConsoleAccess()
  return <div>page</div>
}
