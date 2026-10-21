import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { EmailPreferences } from "@/components/account/email-preferences"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Email preferences", robots: { index: false } }

export default async function EmailPreferencesPage() {
  const session = await requireCustomer("/account/email-preferences")
  // From the row, not the session: its cache can be a few minutes old
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { email: true, getOrderEmails: true, getMarketingEmails: true } })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email preferences</CardTitle>
        <CardDescription>What we send to {user.email}.</CardDescription>
      </CardHeader>
      <CardContent>
        <EmailPreferences initial={{ getOrderEmails: user.getOrderEmails, getMarketingEmails: user.getMarketingEmails }} />
      </CardContent>
    </Card>
  )
}
