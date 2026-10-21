import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import { formatDate } from "@workspace/utils/date"

import type { LegalPage } from "@/lib/settings"

// The Terms or Privacy page: the text the platform wrote in Settings, and when it last changed
export function LegalPageView({ title, page }: { title: string; page: LegalPage }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {formatDate(page.updatedAt, "d MMMM yyyy")}</p>
      <RichTextContent value={page.content} className="mt-8" />
    </article>
  )
}
