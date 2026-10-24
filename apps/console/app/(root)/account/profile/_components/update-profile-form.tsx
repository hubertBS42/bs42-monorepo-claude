"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ImageField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { updateProfileAction } from "@/lib/actions/account.actions"
import { updateProfileSchema } from "@/lib/schemas/account.schemas"
import { deleteImages, uploadImages } from "@/lib/storage"

interface UpdateProfileFormProps {
  user: { name: string | null; email: string; image: string | null }
}

const UpdateProfileForm = ({ user }: UpdateProfileFormProps) => {
  const router = useRouter()

  const form = useForm<z.input<typeof updateProfileSchema>, unknown, z.output<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name ?? "",
      image: user.image ?? "",
    },
  })

  const onSubmit: SubmitHandler<z.output<typeof updateProfileSchema>> = async (data) => {
    // updateProfileAction removes the previous avatar itself once the update has been saved
    const result = await updateProfileAction(data)

    if (!result.success) {
      if (result.code === "INVALID_FILE") {
        form.setError("image", { type: "custom", message: "Upload the avatar again." })
      } else {
        toast.add({ title: "Failed to update profile", description: result.error, type: "error" })
      }
      return
    }

    // The saved values are the new baseline, so the form is no longer dirty
    form.reset({ name: data.name, image: data.image ?? "" })
    toast.add({ title: "Profile updated", description: "Your changes have been saved.", type: "success" })
    router.refresh()
  }

  const handleAddAvatar = async (files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  const handleRemoveAvatar = async (url: string) => {
    // The saved avatar is removed by the server on save, so leaving without saving keeps it intact
    if (url === user.image) return
    await deleteImages([url])
  }

  const isPending = form.formState.isSubmitting

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6">
        <FieldGroup>
          <ImageField
            control={form.control}
            name="image"
            sizeLimit={100}
            maxImages={1}
            onAdd={handleAddAvatar}
            onRemove={handleRemoveAvatar}
            clearErrors={form.clearErrors}
            label="Avatar"
            disabled={isPending}
            className="max-w-35"
            defaultValues={user.image}
          />
          <TextInputField control={form.control} name="name" label="Name" disabled={isPending} />
          {/* Not part of the form: Better Auth's updateUser doesn't change emails */}
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input id="profile-email" type="email" value={user.email} disabled readOnly />
            <FieldDescription>Ask an administrator to change your email.</FieldDescription>
          </Field>
        </FieldGroup>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? <Spinner /> : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default UpdateProfileForm
