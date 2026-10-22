"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import TextareaField from "@workspace/forms/components/textarea-field"
import { ReviewStatus } from "@workspace/db/enums"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import FormDialog from "@/components/form-dialog"
import { hideReviewAction, publishReviewAction } from "@/lib/actions/review.actions"
import { hideReviewSchema } from "@/lib/schemas/review.schemas"
import type { ReviewRow } from "@/types"

// The review changed under the page (someone else hid or published it, or its author deleted it)
const REFRESH_CODES = ["STATUS_CHANGED", "NOT_FOUND"]

// A published review can be hidden, with a reason its author sees; a hidden one published again
export default function ReviewActions({ review }: { review: ReviewRow }) {
  return <div className="flex justify-end">{review.status === ReviewStatus.PUBLISHED ? <HideReview review={review} /> : <PublishReview review={review} />}</div>
}

function HideReview({ review }: { review: ReviewRow }) {
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Hide
        </Button>
      }
      title="Hide this review"
      description={`It comes off ${review.product.name}'s page and out of its rating. Its author sees it as hidden, with your reason.`}
      submitLabel="Hide review"
      failureTitle="Unable to hide the review"
      refreshOn={REFRESH_CODES}
      destructive
      schema={hideReviewSchema}
      values={{ reason: "" }}
      save={(values) => hideReviewAction({ reviewId: review.id, currentStatus: review.status, reason: values.reason })}
      success={() => ({ title: "Review hidden", description: `It no longer shows on ${review.product.name}'s page.` })}
    >
      {(form, isPending) => <TextareaField control={form.control} name="reason" label="Reason" placeholder="e.g. It's about the delivery, not the product" rows={3} disabled={isPending} />}
    </FormDialog>
  )
}

function PublishReview({ review }: { review: ReviewRow }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handlePublish = () => {
    startTransition(async () => {
      const response = await publishReviewAction({ reviewId: review.id, currentStatus: review.status, reason: null })
      if (!response.success) {
        toast.add({ title: "Unable to publish the review", description: response.error, type: "error" })
        if (response.code && REFRESH_CODES.includes(response.code)) {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ title: "Review published", description: `It shows on ${review.product.name}'s page again.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Publish</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this review again?</AlertDialogTitle>
          <AlertDialogDescription>{`It goes back on ${review.product.name}'s page and counts in its rating.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handlePublish()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Publish"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
