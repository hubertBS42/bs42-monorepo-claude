import type { Metadata } from "next"

import { SetPasswordForm } from "./_components/set-password-form"

export const metadata: Metadata = {
  title: "Set new password",
}

type SetupPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>
}
export default async function SetPasswordPage({ searchParams }: SetupPasswordPageProps) {
  const { token, error } = await searchParams

  return <SetPasswordForm token={token} invalidToken={error === "INVALID_TOKEN"} />
}
