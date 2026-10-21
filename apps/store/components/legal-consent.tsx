import Link from "next/link"
import { cn } from "@workspace/ui/lib/utils"

// Which of the Terms and Privacy pages exist; only those are linked
export interface LegalLinks {
  terms: boolean
  privacy: boolean
}

// "By creating an account, you agree to our Terms and Privacy Policy.", naming only the pages that exist, or nothing
// while neither does. The links open a new tab, so the form being filled in isn't lost.
export function LegalConsent({ action, links, className }: { action: string; links: LegalLinks; className?: string }) {
  if (!links.terms && !links.privacy) return null

  const link = (href: string, label: string) => (
    <Link href={href} target="_blank" className="underline underline-offset-4 hover:text-foreground">
      {label}
    </Link>
  )
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      By {action}, you agree to our {links.terms && link("/terms", "Terms")}
      {links.terms && links.privacy && " and "}
      {links.privacy && link("/privacy", "Privacy Policy")}.
    </p>
  )
}

export const legalLinks = (pages: { terms: unknown; privacy: unknown }): LegalLinks => ({ terms: !!pages.terms, privacy: !!pages.privacy })
