import { requireConsoleAdmin } from "@/lib/auth-guard"

export default async function ProductsPage() {
  await requireConsoleAdmin()

  return (
    <div>
      <h1>Products</h1>
    </div>
  )
}
