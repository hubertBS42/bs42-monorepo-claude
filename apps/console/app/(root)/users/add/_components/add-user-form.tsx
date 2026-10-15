"use client"

import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { addUserFormSchema } from "@/lib/schemas/user.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"
import { SubmitHandler, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { SYSTEM_ROLE_NAMES } from "@workspace/auth/system-permissions"
import { ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import SelectField from "@workspace/forms/components/select-field"
import { Plus, Trash2 } from "lucide-react"
import { createUserAction } from "@/lib/actions/user.actions"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { capitalizeWord } from "@workspace/utils/text"
import { StoreForSelect } from "@/types"
import ImageField from "@workspace/forms/components/image-field"
import DateField from "@workspace/forms/components/date-field"
import SwitchField from "@workspace/forms/components/switch-field"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import PhoneField from "@workspace/forms/components/phone-field"
import { deleteImages, uploadImages } from "@/lib/storage"

export default function AddUserForm({ stores }: { stores: StoreForSelect[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<z.infer<typeof addUserFormSchema>>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      image: "",
      phone: "",
      dob: null,
      getMarketingEmails: true,
      getOrderEmails: true,
      getSecurityEmails: true,
      systemRole: "user",
      stores: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stores",
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedRole = form.watch("systemRole")
  const isStoreUser = selectedRole === "user"
  const selectedStores = useWatch({ control: form.control, name: "stores" }) ?? []
  const selectedStoreIds = selectedStores.map((store) => store?.storeId)
  // Errors on the list itself (e.g. no store assigned), as opposed to a single row
  const storesError = form.getFieldState("stores", form.formState).error
  const storesErrorMessage = storesError?.message ?? (storesError as { root?: { message?: string } } | undefined)?.root?.message

  useEffect(() => {
    if (!isStoreUser) return
    if (!stores.length) return

    const currentStores = form.getValues("stores")
    if (currentStores.length === 0) {
      form.setValue("stores", [{ storeId: stores[0]?.id ?? "", storeRole: "member" }])
    }
  }, [form, isStoreUser, stores])

  const systemRoleOptions = SYSTEM_ROLE_NAMES.filter((item) => item !== "superAdmin").map((role) => ({ label: capitalizeWord(role), value: role }))
  const storeRoleOptions = ORG_ROLE_NAMES.filter((item) => item !== "owner").map((role) => ({ label: capitalizeWord(role), value: role }))

  const onSubmit: SubmitHandler<z.infer<typeof addUserFormSchema>> = async (data) => {
    startTransition(async () => {
      const response = await createUserAction({
        name: data.name,
        email: data.email,
        systemRole: data.systemRole,
        image: data.image || undefined,
        phone: data.phone || null,
        dob: data.dob ?? null,
        getMarketingEmails: data.getMarketingEmails,
        getOrderEmails: data.getOrderEmails,
        getSecurityEmails: data.getSecurityEmails,
        stores: data.systemRole === "user" ? data.stores : undefined,
      })

      if (!response.success) {
        // The account exists but a later step failed (role, store assignment or email): say what, and move on
        if (response.error.startsWith("User created, but")) {
          toast.add({
            title: "User created with problems",
            description: response.error,
            type: "warning",
          })
          router.push("/users")
        } else if (response.error === "User already exists. Use another email.") {
          form.setError("email", {
            type: "custom",
            message: "This email address is already registered to a user",
          })
        } else {
          toast.add({
            title: "Failed to create user",
            description: response.error,
            type: "error",
          })
        }
      } else {
        toast.add({
          title: "User created",
          description: "We've emailed them a link to set their password.",
          type: "success",
        })
        router.push("/users")
      }
    })
  }

  const handleAddAvatar = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveAvatar = async (url: string) => {
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    startTransition(async () => {
      const image = form.getValues("image")
      if (image?.trim()) await deleteImages([image])
      router.push("/users")
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Add User"
          description="Create a new user to manage stores and products."
          backTo="/users"
          isPending={isPending}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

        <div className="grid gap-8">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Details</CardTitle>
                <CardDescription>Basic information about the user.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-5">
                <div className="col-span-2 grid">
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
                  />
                </div>
                <div className="col-span-2 grid">
                  <TextInputField control={form.control} label="Full Name" name="name" disabled={isPending} autoFocus />
                </div>
                <div className="col-span-2 grid lg:col-span-1">
                  <TextInputField control={form.control} label="Email" name="email" type="email" disabled={isPending} />
                </div>
                <div className="col-span-2 grid lg:col-span-1">
                  <PhoneField control={form.control} label="Phone" name="phone" disabled={isPending} defaultCountry="GH" />
                </div>
                <div className="col-span-2 grid lg:col-span-1">
                  <DateField control={form.control} name="dob" label="Date of birth" disabled={isPending} disabledDates={(date) => date > new Date() || date < new Date("1900-01-01")} />
                </div>
                <div className="col-span-2 grid lg:col-span-1">
                  <SelectField control={form.control} label="System Role" name="systemRole" options={systemRoleOptions} disabled={isPending} placeholder="Select role" />
                </div>
              </CardContent>
            </Card>

            {isStoreUser && (
              <Card>
                <CardHeader>
                  <CardTitle>Store</CardTitle>
                  <CardDescription>Assign this user to one or more stores.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {fields.map((field, index) => {
                    const availableStoreOptions = stores
                      .filter((store) => !selectedStoreIds.some((storeId, i) => i !== index && storeId === store.id))
                      .map((store) => ({ label: store.name, value: store.id }))

                    return (
                      <div key={field.id} className="grid grid-cols-2 items-end gap-4">
                        <SelectField control={form.control} label="Store" name={`stores.${index}.storeId`} options={availableStoreOptions} disabled={isPending} placeholder="Select store" />
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <SelectField control={form.control} label="Member Role" name={`stores.${index}.storeRole`} options={storeRoleOptions} disabled={isPending} placeholder="Select role" />
                          </div>
                          {fields.length > 1 && (
                            <Button type="button" variant={"outline"} size={"icon"} onClick={() => remove(index)} disabled={isPending} className="mb-0.5">
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {storesErrorMessage && <FieldError errors={[{ message: storesErrorMessage }]} />}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ storeId: stores.find((store) => !selectedStoreIds.includes(store.id))?.id ?? "", storeRole: "member" })}
                    disabled={isPending || fields.length >= stores.length}
                    className="w-full"
                  >
                    <Plus className="size-4" />
                    Add Store
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Settings for this user.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-3">
                  <SwitchField
                    control={form.control}
                    name="getMarketingEmails"
                    label="Marketing emails"
                    description="Receive emails about new products,  and more."
                    disabled={isPending}
                    variant="card"
                  />
                  <SwitchField control={form.control} name="getSecurityEmails" label="Security emails" description="Receive emails about account security." disabled={isPending} variant="card" />
                  <SwitchField control={form.control} name="getOrderEmails" label="Order emails" description="Receive emails about order updates." disabled={isPending} variant="card" />
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          <SharedFormFooter backTo="/users" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
