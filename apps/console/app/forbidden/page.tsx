export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center space-y-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">You don&apos;t have access to the console. Ask an administrator if you should.</p>
    </main>
  )
}
