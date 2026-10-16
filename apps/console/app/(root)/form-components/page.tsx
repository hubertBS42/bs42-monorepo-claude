import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { requireConsoleAdmin } from "@/lib/auth-guard"
import { FormComponentsDemo } from "./_components/form-components-demo"

export const metadata: Metadata = {
  title: "Form components",
}

// A development preview of the form fields, not a feature: admins only, and it doesn't exist in production
export default async function FormComponentsPage() {
  await requireConsoleAdmin()
  if (process.env.NODE_ENV === "production") notFound()

  return <FormComponentsDemo />
}
