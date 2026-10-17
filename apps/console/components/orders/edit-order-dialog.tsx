"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { Pencil } from "lucide-react"
import type { ActionResponse } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"

interface EditOrderDialogProps<T extends FieldValues> {
  // The store whose page this is, or null on the platform's pages
  storeId: string | null
  // "Edit customer"
  label: string
  title: string
  description: string
  schema: z.ZodType<T, T>
  values: T
  save: (values: T) => Promise<ActionResponse>
  children: (form: UseFormReturn<T>, isPending: boolean) => ReactNode
}

// An edit of a pending order; the page only renders it for one the viewer manages. Hidden from roles that can't
// update orders, and the actions check again.
export default function EditOrderDialog<T extends FieldValues>({ storeId, label, title, description, schema, values, save, children }: EditOrderDialogProps<T>) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { canUpdate, isLoading } = useCanUpdateOrders(storeId)
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: values as DefaultValues<T> })

  if (isLoading || !canUpdate) return null

  const onSubmit = (submitted: T) => {
    startTransition(async () => {
      const response = await save(submitted)
      if (!response.success) {
        toast.add({ title: "Unable to save", description: response.error, type: "error" })
        // It's no longer pending: show where it is now
        if (response.code === "NOT_PENDING") {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ title: "Order updated", description: "Your changes have been saved.", type: "success" })
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
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="justify-self-start">
            <Pencil className="size-3.5" />
            {label}
          </Button>
        }
      />
      <DialogContent>
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
          {children(form, isPending)}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
