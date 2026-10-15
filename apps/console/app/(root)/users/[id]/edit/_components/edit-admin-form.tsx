"use client"

import type { UserDetails } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { editAdminFormSchema } from "@/lib/schemas/user.schemas"
import UserFormFields from "./user-form-fields"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { updateUserAction } from "@/lib/actions/user.actions"
import { deleteImages } from "@/lib/storage"

const EditAdminForm = ({ user }: { user: UserDetails }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const form = useForm<z.infer<typeof editAdminFormSchema>>({
    resolver: zodResolver(editAdminFormSchema),
    defaultValues: {
      id: user.id,
      name: user.name ?? "",
      email: user.email,
      image: user.image ?? "",
      phone: user.phone,
      dob: user.dob,
      getMarketingEmails: user.getMarketingEmails,
      getSecurityEmails: user.getSecurityEmails,
      getOrderEmails: user.getOrderEmails,
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof editAdminFormSchema>> = (data) => {
    startTransition(async () => {
      // Email is read-only here, so it isn't sent
      const result = await updateUserAction({
        id: data.id,
        name: data.name,
        image: data.image,
        phone: data.phone,
        dob: data.dob,
        getMarketingEmails: data.getMarketingEmails,
        getOrderEmails: data.getOrderEmails,
        getSecurityEmails: data.getSecurityEmails,
      })

      if (!result.success) {
        toast.add({
          title: "Operation failed",
          description: result.error,
          type: "error",
        })
        return
      }

      // The previous avatar is only removed once the update has been saved
      if (user.image && data.image !== user.image) {
        await deleteImages([user.image]).catch(() => undefined)
      }

      toast.add({
        title: "Operation successful",
        description: "User successfully updated.",
        type: "success",
      })
      router.push("/users")
    })
  }

  const handleDiscard = () => {
    startTransition(async () => {
      // The saved avatar is only deleted on submit, so only a newly uploaded one needs removing
      const image = form.getValues("image")
      try {
        if (image && image !== user.image) await deleteImages([image])
        router.push("/users")
      } catch (error) {
        toast.add({
          title: "Unable to discard changes",
          description: error instanceof Error ? error.message : "The uploaded avatar could not be removed. Please try again.",
          type: "error",
        })
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader heading="Edit User" description="Manage user's account." backTo="/users" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />

        <div className="grid gap-8">
          <UserFormFields control={form.control} user={user} isPending={isPending} clearErrors={form.clearErrors} />

          <SharedFormFooter backTo="/users" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}

export default EditAdminForm
