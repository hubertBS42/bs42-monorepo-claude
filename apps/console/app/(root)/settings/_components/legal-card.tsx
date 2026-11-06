"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type Control, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { Eye, ExternalLink, Save } from "lucide-react"
import { SwitchField } from "@workspace/forms"
import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import RichTextField from "@workspace/forms/components/rich-text-editor/rich-text-field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"
import { saveLegalPagesAction } from "@/lib/actions/legal.actions"
import type { LegalPagesView } from "@/lib/data/legal.data"
import { legalPagesFormSchema } from "@/lib/schemas/legal.schemas"

// Its own form, saved apart from the settings row (the LegalPages singleton). Each page is a draft until it's
// published, so it can be written and previewed before customers see it.

type FormInput = z.input<typeof legalPagesFormSchema>
type FormOutput = z.output<typeof legalPagesFormSchema>

interface PageConfig {
  title: string
  path: "/terms" | "/privacy"
  textName: "termsOfService" | "privacyPolicy"
  publishedName: "termsPublished" | "privacyPublished"
  placeholder: string
  // As saved: what the storefront shows now
  savedPublished: boolean
  savedAt: string | null
}

export default function LegalCard({ pages, storefrontUrl }: { pages: LegalPagesView; storefrontUrl: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Values waiting for the unpublish confirmation
  const [toConfirm, setToConfirm] = useState<{ values: FormOutput; titles: string[] } | null>(null)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(legalPagesFormSchema),
    defaultValues: { termsOfService: pages.termsOfService, termsPublished: pages.termsPublished, privacyPolicy: pages.privacyPolicy, privacyPublished: pages.privacyPublished },
  })
  // The publish switch's "write it first" error clears as the text is written
  useRevalidateOnChange(form)

  const configs: PageConfig[] = [
    {
      title: "Terms",
      path: "/terms",
      textName: "termsOfService",
      publishedName: "termsPublished",
      placeholder: "The terms customers buy under...",
      savedPublished: pages.termsPublished,
      savedAt: pages.termsUpdatedAt,
    },
    {
      title: "Privacy Policy",
      path: "/privacy",
      textName: "privacyPolicy",
      publishedName: "privacyPublished",
      placeholder: "What you collect, why, and who you share it with...",
      savedPublished: pages.privacyPublished,
      savedAt: pages.privacyUpdatedAt,
    },
  ]

  const save = (values: FormOutput) => {
    startTransition(async () => {
      const response = await saveLegalPagesAction({ version: pages.version, pages: values })
      setToConfirm(null)

      if (!response.success) {
        toast.add({ title: "Unable to save the legal pages", description: response.error, type: "error" })
        if (response.code === "CONFLICT") router.refresh()
        return
      }

      toast.add({ title: "Legal pages saved", description: "The storefront shows what's published within a minute.", type: "success" })
      form.reset(form.getValues())
      router.refresh()
    })
  }

  // Taking down a page customers have seen asks first: they agreed to it when they ordered or signed up
  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    const unpublishing = configs.filter((config) => config.savedPublished && !values[config.publishedName]).map((config) => config.title)
    if (unpublishing.length) setToConfirm({ values, titles: unpublishing })
    else save(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal</CardTitle>
        <CardDescription>The storefront shows a page once it&apos;s published.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* stopPropagation keeps a submit from reaching any form around it */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-8"
        >
          {configs.map((config) => (
            <LegalPageFields key={config.path} config={config} control={form.control} url={`${storefrontUrl}${config.path}`} disabled={isPending} />
          ))}

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

      <AlertDialog open={!!toConfirm} onOpenChange={(open) => !open && !isPending && setToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish {toConfirm?.titles.join(" and ")}?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers can no longer read {toConfirm?.titles.length === 1 ? "it" : "them"}, though those who ordered or signed up meanwhile agreed to {toConfirm?.titles.length === 1 ? "it" : "them"}.
              The footer, sign-up and checkout stop linking to {toConfirm?.titles.length === 1 ? "it" : "them"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                if (toConfirm) save(toConfirm.values)
              }}
            >
              {isPending ? <Spinner /> : "Unpublish and save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// One page: its text, whether it's published, where customers see it, and a preview of it as they would
function LegalPageFields({ config, control, url, disabled }: { config: PageConfig; control: Control<FormInput, unknown, FormOutput>; url: string; disabled: boolean }) {
  const text = useWatch({ control, name: config.textName })

  return (
    <div className="grid gap-3">
      <RichTextField control={control} name={config.textName} label={config.title} placeholder={config.placeholder} disabled={disabled} />
      <SwitchField
        control={control}
        name={config.publishedName}
        label="Published"
        description={`Shown at ${config.path}, and linked from the footer, sign-up and checkout`}
        variant="card"
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{config.savedPublished ? `Live, last updated ${formatDate(config.savedAt ?? "", "d MMM yyyy")}.` : "Not on the storefront."}</span>
        {config.savedPublished && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
            View
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <Dialog>
          <DialogTrigger
            render={
              <Button type="button" variant="ghost" size="sm" disabled={!text}>
                <Eye /> Preview
              </Button>
            }
          />
          {/* The text as it is in the editor now, rendered as the storefront renders it */}
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
            </DialogHeader>
            <RichTextContent value={text ?? null} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
