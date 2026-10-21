import { ExternalLink } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { StorefrontLink } from "@/lib/data/storefront-links.data"

// The edit forms' link to the product's storefront page, or why customers can't see it
export function StorefrontLinkCard({ link, description }: { link: StorefrontLink; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Storefront</CardTitle>
        <CardDescription>{link.url ? description : `Not on sale. ${link.reason ?? ""}`}</CardDescription>
      </CardHeader>
      {link.url && (
        <CardContent>
          <a href={link.url} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            View on storefront
            <ExternalLink data-icon="inline-end" aria-hidden />
          </a>
        </CardContent>
      )}
    </Card>
  )
}
