"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { ExternalLink, Save } from "lucide-react"
import RichTextField from "@workspace/forms/components/rich-text-editor/rich-text-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { saveLegalPagesAction } from "@/lib/actions/legal.actions"
import type { LegalPagesView } from "@/lib/data/legal.data"
import { legalPagesFormSchema } from "@/lib/schemas/legal.schemas"

// Its own form, saved apart from the settings row (the LegalPages singleton)

type FormInput = z.input<typeof legalPagesFormSchema>
type FormOutput = z.output<typeof legalPagesFormSchema>

// Under each editor: when the page last changed, and a link to it on the storefront
function pageStatus(updatedAt: string | null, url: string) {
  if (!updatedAt) return "No page yet: the storefront doesn't link to it."
  return `Shown at ${url}, last changed ${formatDate(updatedAt, "d MMM yyyy")}.`
}

export default function LegalCard({ pages, storefrontUrl }: { pages: LegalPagesView; storefrontUrl: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(legalPagesFormSchema),
    defaultValues: { termsOfService: pages.termsOfService, privacyPolicy: pages.privacyPolicy },
  })

  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    startTransition(async () => {
      const response = await saveLegalPagesAction({ version: pages.version, pages: values })

      if (!response.success) {
        toast.add({ title: "Unable to save the legal pages", description: response.error, type: "error" })
        if (response.code === "CONFLICT") router.refresh()
        return
      }

      toast.add({ title: "Legal pages saved", description: "The storefront shows them within a minute.", type: "success" })
      form.reset(form.getValues())
      router.refresh()
    })
  }

  const termsUrl = `${storefrontUrl}/terms`
  const privacyUrl = `${storefrontUrl}/privacy`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal</CardTitle>
        <CardDescription>The storefront&apos;s Terms and Privacy Policy. Sign-up and checkout tell customers that continuing means agreeing to them. Leave one empty to not show it.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* stopPropagation keeps a submit from reaching any form around it */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-6"
        >
          <div className="grid gap-2">
            <RichTextField control={form.control} name="termsOfService" label="Terms" placeholder="The terms customers buy under..." disabled={isPending} />
            <PageLink status={pageStatus(pages.termsUpdatedAt, termsUrl)} url={pages.termsUpdatedAt ? termsUrl : null} />
          </div>
          <div className="grid gap-2">
            <RichTextField control={form.control} name="privacyPolicy" label="Privacy Policy" placeholder="What you collect, why, and who you share it with..." disabled={isPending} />
            <PageLink status={pageStatus(pages.privacyUpdatedAt, privacyUrl)} url={pages.privacyUpdatedAt ? privacyUrl : null} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? (
                <Spinner />
              ) : (
                <>
                  <Save /> Save
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PageLink({ status, url }: { status: string; url: string | null }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      {status}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
          View
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </p>
  )
}
