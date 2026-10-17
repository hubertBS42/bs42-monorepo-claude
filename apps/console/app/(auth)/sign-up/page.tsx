import { prisma } from "@workspace/db"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import z from "zod"
import { InvitedSignUpForm } from "./_components/invited-sign-up-form"

export const metadata: Metadata = {
  title: "Create Account",
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation: invitationId } = await searchParams

  // Accounts can only be created from a valid invitation
  if (!invitationId || !z.uuid().safeParse(invitationId).success) redirect("/login")

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  })

  // The invitation page explains why it can't be used
  if (!invitation || invitation.status !== "pending" || (invitation.expiresAt && invitation.expiresAt < new Date())) redirect(`/accept-invitation/${invitationId}`)

  return <InvitedSignUpForm invitationId={invitationId} email={invitation.email} storeName={invitation.organization.name} />
}
