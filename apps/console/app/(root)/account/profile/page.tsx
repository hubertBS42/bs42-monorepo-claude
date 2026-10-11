import { requireConsoleAccess } from "@/lib/auth-guard"

export default async function ProfilePage() {
  await requireConsoleAccess()
  return <div>page</div>
}
