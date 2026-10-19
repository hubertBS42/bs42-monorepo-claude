"use client"

import { useState, useTransition, type ReactElement, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import type { ActionResponse } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

// A dialog with a form that saves through an action, then refreshes the page. Used by the order refund and return
// dialogs and the purchase order ones. The form holds the schema's input (an amount field can be empty) and submits
// its output.
interface FormDialogProps<In extends FieldValues, Out extends FieldValues> {
  trigger: ReactElement
  title: string
  description: string
  submitLabel: string
  // The error toast's title
  failureTitle: string
  // Codes meaning the record changed under the page: the dialog closes and the page refreshes to show it as it is now
  refreshOn: string[]
  destructive?: boolean
  className?: string
  schema: z.ZodType<Out, In>
  values: In
  save: (values: Out) => Promise<ActionResponse>
  success: (values: Out) => { title: string; description: string }
  children: (form: UseFormReturn<In, unknown, Out>, isPending: boolean) => ReactNode
}

export default function FormDialog<In extends FieldValues, Out extends FieldValues>({
  trigger,
  title,
  description,
  submitLabel,
  failureTitle,
  refreshOn,
  destructive,
  className,
  schema,
  values,
  save,
  success,
  children,
}: FormDialogProps<In, Out>) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: values as DefaultValues<In> })

  const onSubmit = (submitted: Out) => {
    startTransition(async () => {
      const response = await save(submitted)
      if (!response.success) {
        toast.add({ title: failureTitle, description: response.error, type: "error" })
        if (response.code && refreshOn.includes(response.code)) {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ ...success(submitted), type: "success" })
      router.refresh()
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Reset on open: onOpenChange doesn't run when a save closes the dialog
        if (open) form.reset(values)
        setIsOpen(open)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-6"
        >
          <FieldGroup>{children(form, isPending)}</FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
              Back
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={isPending}>
              {isPending ? <Spinner /> : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
