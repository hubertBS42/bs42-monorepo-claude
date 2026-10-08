/* eslint-disable @next/next/no-img-element */
import { consoleAuth } from "@workspace/auth/console"
import { hasConsoleAccess } from "@/lib/auth-guard"
import { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getAppSettings } from "@/lib/app-settings"

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

  const settings = await getAppSettings()

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {settings.logoUrl && (
          <div className="mb-6 flex justify-center">
            <img src={settings.logoUrl} alt={settings.consoleName ?? ""} className="h-12 w-auto max-w-32 object-contain" />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
