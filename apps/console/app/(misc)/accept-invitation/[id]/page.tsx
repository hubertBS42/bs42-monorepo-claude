import { redirect } from "next/navigation"
import { headers } from "next/headers"
import AcceptInvitationUI from "./_components/accept-invitation-ui"
import { Metadata } from "next"
import { prisma } from "@workspace/db"
import consoleAuth from "@workspace/auth/console"

interface AcceptInvitationPageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Store Invitation",
}
const AcceptInvitationPage = async ({ params }: AcceptInvitationPageProps) => {
  const { id } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { inviter: true, organization: true },
  })

  if (!invitation || invitation.status !== "pending" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
    redirect("/login")
  }

  // Check if user is already signed in
  const session = await consoleAuth.api.getSession({ headers: await headers() })

  if (!session) {
    const callbackURL = encodeURIComponent(`/accept-invitation/${id}`)
    const user = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
      select: { id: true },
    })

    redirect(user ? `/login?callbackURL=${callbackURL}` : `/sign-up?invitation=${id}`)
  }

  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="grid w-full max-w-md gap-2 p-6 text-center">
          <h1 className="text-2xl font-bold">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This invitation was sent to a different email address. Sign in with the invited account to accept it.
          </p>
        </div>
      </div>
    )
  }

  // User is signed in — show accept/decline UI
  return <AcceptInvitationUI invitation={invitation} />
}

export default AcceptInvitationPage
