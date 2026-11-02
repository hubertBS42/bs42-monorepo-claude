import { Metadata } from "next"
import { ReactNode } from "react"
import SectionLayout from "@/components/section-layout"
import AccountNav from "./_components/account-nav"

export const metadata: Metadata = {
  title: "Account",
}

const AccountLayout = ({ children }: { children: ReactNode }) => {
  return (
    <SectionLayout title="Account" description="Manage your account settings and preferences." nav={<AccountNav />}>
      {children}
    </SectionLayout>
  )
}

export default AccountLayout
