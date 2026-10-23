"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Star } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import TextareaField from "@workspace/forms/components/textarea-field"
import TextInputField from "@workspace/forms/components/text-input-field"
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
import { Field, FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { deleteReviewAction, saveReviewAction } from "@/lib/actions/review.actions"
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_TITLE_MAX, reviewSchema, type ReviewValues } from "@/lib/schemas/review.schemas"

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

// Five stars as radio buttons: arrow keys move between them, as with any radio group
function StarPicker({ value, onChange, disabled, invalid }: { value: number; onChange: (rating: number) => void; disabled?: boolean; invalid?: boolean }) {
  const [hovered, setHovered] = useState(0)
  const shown = hovered || value

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-labelledby="rating-label" aria-invalid={invalid} className="flex" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className={cn("cursor-pointer p-0.5", disabled && "cursor-not-allowed opacity-60")} onMouseEnter={() => !disabled && setHovered(rating)}>
            <input type="radio" name="rating" value={rating} checked={value === rating} onChange={() => onChange(rating)} disabled={disabled} className="peer sr-only" />
            <span className="sr-only">{rating === 1 ? "1 star" : `${rating} stars`}</span>
            <Star
              aria-hidden
              strokeWidth={1.5}
              fill="currentColor"
              className={cn("size-8 rounded-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring", rating <= shown ? "text-amber-500" : "text-muted-foreground/30")}
            />
          </label>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{RATING_WORDS[shown]}</span>
    </div>
  )
}

// Writes the customer's review of a product, or edits theirs (`isEdit`, which also offers deleting it)
export function ReviewForm({ productId, productSlug, initial, isEdit }: { productId: string; productSlug: string; initial: ReviewValues; isEdit: boolean }) {
  const router = useRouter()
  const form = useForm<ReviewValues>({ resolver: zodResolver(reviewSchema), defaultValues: initial })
  const { isSubmitting } = form.formState
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const busy = isSubmitting || isDeleting

  async function onSubmit(values: ReviewValues) {
    form.clearErrors("root")
    try {
      const result = await saveReviewAction(productId, values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        if (result.code === "UNAUTHORIZED" || result.code === "NOT_ELIGIBLE") router.refresh()
        return
      }
      toast.add({
        title: isEdit ? "Review updated" : "Thanks for your review",
        description: result.data.published ? "It shows on the product's page within a minute." : "Your review stays hidden, as before.",
        type: "success",
      })
      router.push("/account/reviews")
      router.refresh()
    } catch (error) {
      console.error("Saving a review failed:", error)
      form.setError("root", { message: "We couldn't save your review just now. Please try again." })
    }
  }

  const remove = () =>
    startDelete(async () => {
      try {
        const result = await deleteReviewAction(productId)
        if (!result.success) {
          toast.add({ title: "Couldn't delete your review", description: result.error, type: "error" })
          return
        }
        setIsDeleteOpen(false)
        toast.add({ title: "Review deleted", type: "success" })
        router.push("/account/reviews")
        router.refresh()
      } catch (error) {
        console.error("Deleting a review failed:", error)
        toast.add({ title: "Something went wrong", description: "Please try again.", type: "error" })
      }
    })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <Controller
        control={form.control}
        name="rating"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="grid gap-1">
            <p id="rating-label" className="text-sm leading-snug font-medium">
              Your rating
            </p>
            <StarPicker value={field.value} onChange={field.onChange} disabled={busy} invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <TextInputField control={form.control} name="title" label="Title" placeholder="Sum it up in a few words" maxLength={REVIEW_TITLE_MAX} showCount disabled={busy} />
      <TextareaField
        control={form.control}
        name="body"
        label="Your review"
        placeholder="What did you like or dislike? How are you using it?"
        rows={6}
        maxLength={REVIEW_BODY_MAX}
        showCount
        description={`At least ${REVIEW_BODY_MIN} characters. Your first name and last initial show with it.`}
        disabled={busy}
      />
      {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Post review"}
        </Button>
        <Button render={<Link href={isEdit ? "/account/reviews" : `/p/${productSlug}`} />} variant="outline" disabled={busy}>
          Cancel
        </Button>
        {isEdit && (
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogTrigger render={<Button type="button" variant="ghost" className="ml-auto text-destructive" disabled={busy} />}>Delete review</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your review?</AlertDialogTitle>
                <AlertDialogDescription>It comes off the product&apos;s page. You can write a new one later.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.preventDefault()
                    remove()
                  }}
                >
                  {isDeleting && <Spinner data-icon="inline-start" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  )
}
