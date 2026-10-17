import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { requireConsoleAccess } from "@/lib/auth-guard"
import UpdatePasswordForm from "./_components/update-password-form"

export default async function PasswordPage() {
  await requireConsoleAccess()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing your password signs you out on every other device.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  )
}
