"use client"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { banUserFormSchema } from "@/lib/schemas/user.schemas"
import { useRouter } from "next/navigation"
import DateField from "@workspace/forms/components/date-field"
import TextAreaField from "@workspace/forms/components/textarea-field"
import { Spinner } from "@workspace/ui/components/spinner"
import type { User } from "@workspace/db/client"
import { banUserAction } from "@/lib/actions/user.actions"
import { ShieldX } from "lucide-react"

const BanUser = ({ user }: { user: User }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<z.infer<typeof banUserFormSchema>>({
    resolver: zodResolver(banUserFormSchema),
    defaultValues: {
      userId: user.id,
      banReason: "",
      banExpiresIn: null,
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof banUserFormSchema>> = (values) => {
    startTransition(async () => {
      const response = await banUserAction(values)
      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      setIsOpen(false)
      form.reset()
      router.refresh()
      toast.add({
        title: "Operation successful",
        description: "User has been banned.",
        type: "success",
      })
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button type="button" className="w-full text-red-500 hover:bg-red-50 hover:text-red-700" variant={"outline"}>
            <ShieldX className="size-5" />
            Ban User
          </Button>
        }
      />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>Ban user account either temporarily or permanently.</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <DateField control={form.control} name="banExpiresIn" label="Ban Expiration" disabled={isPending} disabledDates={(date) => date < new Date()} />
            </div>

            <div className="col-span-2">
              <TextAreaField control={form.control} label="Ban Reason" name="banReason" disabled={isPending} />
            </div>
            <div className="col-span-2">
              <Button className="w-full" type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : "Proceed"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default BanUser
