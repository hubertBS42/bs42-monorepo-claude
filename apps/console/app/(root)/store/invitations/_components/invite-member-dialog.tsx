"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserPlus } from "lucide-react"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import SelectField from "@workspace/forms/components/select-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { STORE_ROLE_LABELS } from "@/components/user-badges"
import { inviteMemberAction } from "@/lib/actions/invitation.actions"
import { inviteSchema } from "@/lib/schemas/invitation.schemas"

const roleOptions = inviteSchema.shape.role.options.map((role) => ({ label: STORE_ROLE_LABELS[role] ?? role, value: role }))

type InviteFormValues = z.infer<typeof inviteSchema>

// Rendered only for members who can invite; inviteMemberAction checks again
const InviteMemberDialog = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  })

  const onSubmit: SubmitHandler<InviteFormValues> = (values) => {
    startTransition(async () => {
      const response = await inviteMemberAction(values)

      if (!response.success) {
        if (response.code === "ALREADY_INVITED" || response.code === "ALREADY_MEMBER") {
          form.setError("email", { type: "custom", message: response.error })
        } else {
          toast.add({ title: "Unable to send the invitation", description: response.error, type: "error" })
        }
        return
      }

      form.reset()
      setIsOpen(false)
      toast.add({ title: "Invitation sent", description: `An invitation has been sent to ${values.email}.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) form.reset()
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <UserPlus className="size-4" />
            Invite Member
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>Send an invitation to join this store.</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
        >
          <div className="grid gap-6">
            <FieldGroup>
              <TextInputField control={form.control} label="Email" name="email" type="email" disabled={isPending} autoFocus />
              <SelectField control={form.control} label="Role" name="role" disabled={isPending} options={roleOptions} />
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : "Send Invite"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default InviteMemberDialog
