import { requireConsoleAccess } from "@/lib/auth-guard"

export default async function PasswordPage() {
  await requireConsoleAccess()
  return <div>page</div>
}
