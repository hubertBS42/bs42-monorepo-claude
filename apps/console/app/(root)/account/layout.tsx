import { Metadata } from "next"
import AccountNav from "./_components/account-nav"
import { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Account",
}

const AccountLayout = ({ children }: { children: ReactNode }) => {
  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <AccountNav />
      {children}
    </main>
  )
}

export default AccountLayout
