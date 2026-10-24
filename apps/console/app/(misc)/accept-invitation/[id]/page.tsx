import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import z from "zod"
import AcceptInvitationUI from "./_components/accept-invitation-ui"
import InvitationMessage from "./_components/invitation-message"
import SwitchAccountButton from "./_components/switch-account-button"
import { Metadata } from "next"
import { prisma } from "@workspace/db"
import consoleAuth from "@workspace/auth/console"
import { buttonVariants } from "@workspace/ui/components/button"

interface AcceptInvitationPageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Store Invitation",
}

// Public in proxy.ts: a signed-out invitee is sent to sign-up or login from here
const AcceptInvitationPage = async ({ params }: AcceptInvitationPageProps) => {
  const { id } = await params

  // Invitation.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  const invitation = z.uuid().safeParse(id).success
    ? await prisma.invitation.findUnique({
        where: { id },
        // Matches InvitationDetails: the page goes to the invitee
        include: { inviter: { select: { name: true, email: true } }, organization: { select: { name: true } } },
      })
    : null

  if (!invitation || invitation.status !== "pending" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
    return (
      <InvitationMessage
        title="Invitation unavailable"
        action={
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Go to sign in
          </Link>
        }
      >
        This invitation has expired, been cancelled or already been used. Ask the store that invited you to send a new one.
      </InvitationMessage>
    )
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
      <InvitationMessage title="Signed in with another account" action={<SwitchAccountButton invitationId={id} />}>
        {`This invitation is for ${invitation.email}, but you're signed in as ${session.user.email}. Sign out to accept it with the invited email.`}
      </InvitationMessage>
    )
  }

  // User is signed in — show accept/decline UI
  return <AcceptInvitationUI invitation={invitation} />
}

export default AcceptInvitationPage
