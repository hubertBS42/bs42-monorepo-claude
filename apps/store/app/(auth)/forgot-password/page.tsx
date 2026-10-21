import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ForgotPasswordForm } from "@/components/account/forgot-password-form"
import { getStoreSession } from "@/lib/session"

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } }

export default async function ForgotPasswordPage() {
  if (await getStoreSession()) redirect("/")
  return <ForgotPasswordForm />
}
