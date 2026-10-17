import type { ReactNode } from "react"

// A full-page message for an invitation that can't be accepted here, with what the visitor can do next
const InvitationMessage = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-md gap-4 p-6 text-center">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
        {action}
      </div>
    </div>
  )
}

export default InvitationMessage
