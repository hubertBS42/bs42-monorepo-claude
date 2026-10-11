import { requireConsoleAdmin } from "@/lib/auth-guard"

export default async function DetailsPage() {
  await requireConsoleAdmin()
  return <div>page</div>
}
