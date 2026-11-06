import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@workspace/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { ChangePasswordForm, ProfileForm } from "@/components/account/account-details-forms"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Account details", robots: { index: false } }

export default async function AccountDetailsPage() {
  const session = await requireCustomer("/account/details")
  // From the rows, not the session: its cache can be a few minutes old. An account made with Google has no password.
  const [user, credential] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true, email: true, phone: true } }),
    prisma.account.findFirst({ where: { userId: session.user.id, providerId: "credential", password: { not: null } }, select: { id: true } }),
  ])

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>You sign in as {user.email}. Orders and quotations are matched to your account by it, so it can&apos;t be changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initial={{ name: user.name ?? "", phone: user.phone ?? "" }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {credential ? (
              "Changing it signs you out on your other devices."
            ) : (
              <>
                You sign in with Google, so there&apos;s no password to change. To add one, use{" "}
                <Link href="/forgot-password" className="underline underline-offset-4 hover:text-foreground">
                  Forgot your password
                </Link>{" "}
                with {user.email}.
              </>
            )}
          </CardDescription>
        </CardHeader>
        {credential && (
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
