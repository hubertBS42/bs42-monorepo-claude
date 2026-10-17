import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { prisma } from "@workspace/db"
import { requireConsoleAccess } from "@/lib/auth-guard"
import UpdateProfileForm from "./_components/update-profile-form"

export default async function ProfilePage() {
  const session = await requireConsoleAccess()

  // Read from the database: the session's copy can be stale while the cookie cache lasts
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name and avatar as other console users see them.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpdateProfileForm user={user} />
      </CardContent>
    </Card>
  )
}
