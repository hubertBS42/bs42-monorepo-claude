export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center space-y-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">
        Your account does not have permission to access the console. Contact an administrator if you believe you should
        have access.
      </p>
    </main>
  )
}
