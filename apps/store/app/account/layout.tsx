import { AccountNav } from "@/components/account/account-nav"

// The signed-in customer's pages. No guard here: layouts don't run again on client navigation, so each page calls
// requireCustomer itself.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16 lg:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">Your account</h1>
      <div className="grid gap-6 md:grid-cols-[12rem_1fr] md:gap-10">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
