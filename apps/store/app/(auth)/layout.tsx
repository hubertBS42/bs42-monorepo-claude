// The account pages, after shadcn's login-03 and signup-03 blocks: a card on a muted band between the site's header
// and footer, filling the space between them.
// No guard here: layouts don't run again on client navigation, so each page checks the session itself.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-muted px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">{children}</div>
    </div>
  )
}
