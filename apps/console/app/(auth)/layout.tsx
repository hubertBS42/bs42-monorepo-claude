/* eslint-disable @next/next/no-img-element */
import { consoleAuth } from "@workspace/auth/console"
import { hasConsoleAccess } from "@/lib/auth-guard"
import { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const session = await consoleAuth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect((await hasConsoleAccess(session.user)) ? "/" : "/no-stores")
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <img src="/images/logo.png" alt="BS42.NET logo" className="h-12 w-auto max-w-32 object-contain" />
        </div>
        {children}
      </div>
    </div>
  )
}
