import { requireConsoleAdmin } from "@/lib/auth-guard"
import { ReactNode } from "react"

export default async function Layout({ children }: { children: ReactNode }) {
  await requireConsoleAdmin()
  return children
}
