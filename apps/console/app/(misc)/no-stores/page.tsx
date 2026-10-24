import SignOutButton from "@/components/sign-out-button"
import { getConsoleSession, hasConsoleAccess } from "@/lib/auth-guard"
import { Building2 } from "lucide-react"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getConsoleName } from "@/lib/app-settings"

export const metadata: Metadata = {
  title: "No Stores Found",
}

const NoStoresPage = async () => {
  const session = await getConsoleSession()
  if (await hasConsoleAccess(session.user)) redirect("/")

  const appName = await getConsoleName()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-md gap-6 p-6 text-center">
        <div className="flex justify-center">
          <Building2 className="size-16 text-muted-foreground" />
        </div>
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold">No Stores Found</h1>
          <p className="text-sm text-muted-foreground">You aren&apos;t a member of any store on {appName}. Ask a store admin to invite you.</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  )
}

export default NoStoresPage
