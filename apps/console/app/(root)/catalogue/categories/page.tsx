import { requireConsoleAdmin } from "@/lib/auth-guard"

export default async function CategoriesPage() {
  await requireConsoleAdmin()

  return (
    <div>
      <h1>Categories</h1>
    </div>
  )
}
