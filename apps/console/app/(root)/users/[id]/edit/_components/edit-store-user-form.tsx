"use client"

import type { SelectItem, UserDetails } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { SubmitHandler, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { editStoreUserFormSchema } from "@/lib/schemas/user.schemas"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError } from "@workspace/ui/components/field"
import SelectField from "@workspace/forms/components/select-field"
import { ORG_ROLE_NAMES, OrgRole } from "@workspace/auth/organization-permissions"
import { capitalizeWord } from "@workspace/utils/text"
import { Plus, Trash2 } from "lucide-react"
import UserFormFields from "./user-form-fields"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { Badge } from "@workspace/ui/components/badge"
import { updateUserAction } from "@/lib/actions/user.actions"
import { deleteImages } from "@/lib/storage"

type StoreRow = z.infer<typeof editStoreUserFormSchema>["stores"][number]

const storeRoleOptions = ORG_ROLE_NAMES.filter((item) => item !== "owner").map((role) => ({ label: capitalizeWord(role), value: role }))

// Compares the submitted rows with the user's memberships. Removals are derived here rather than tracked as rows are
// deleted, so a store that was removed and then added back is treated as the original membership, not a remove + add.
function getMembershipChanges(members: UserDetails["members"], rows: StoreRow[]) {
  const submittedStoreIds = new Set(rows.map((row) => row.storeId))

  const removedMembers = members.filter((member) => !submittedStoreIds.has(member.organizationId)).map((member) => ({ memberId: member.id, storeId: member.organizationId }))

  const stores = rows.map((row): StoreRow => {
    if (!row.isNew) return row
    const existing = members.find((member) => member.organizationId === row.storeId)
    return existing ? { ...row, memberId: existing.id, isNew: false } : row
  })

  return { stores, removedMembers }
}

const EditStoreUserForm = ({ user, stores }: { user: UserDetails; stores: SelectItem[] }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<z.infer<typeof editStoreUserFormSchema>>({
    resolver: zodResolver(editStoreUserFormSchema),
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
      stores: [...user.members]
        .sort((a, b) => a.organization.name.localeCompare(b.organization.name))
        .map((member) => ({
          memberId: member.id,
          storeId: member.organizationId,
          storeRole: member.role as OrgRole,
          isNew: false,
        })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stores",
  })

  // Watched (not getValues) so every row's options update when another row's store changes
  const selectedStores = useWatch({ control: form.control, name: "stores" }) ?? []
  const selectedStoreIds = selectedStores.map((store) => store?.storeId)
  // Errors on the list itself (e.g. no store assigned), as opposed to a single row
  const storesError = form.getFieldState("stores", form.formState).error
  const storesErrorMessage = storesError?.message ?? (storesError as { root?: { message?: string } } | undefined)?.root?.message

  const onSubmit: SubmitHandler<z.infer<typeof editStoreUserFormSchema>> = (data) => {
    startTransition(async () => {
      const { stores: storeChanges, removedMembers } = getMembershipChanges(user.members, data.stores)

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
        stores: storeChanges,
        removedMembers,
      })

      // The profile is saved even when some store changes failed, so that case finishes like a success
      const profileSaved = result.success || result.error.startsWith("User updated, but")
      if (!profileSaved) {
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

      if (result.success) {
        toast.add({
          title: "Operation successful",
          description: "User successfully updated.",
          type: "success",
        })
      } else {
        toast.add({
          title: "User updated with problems",
          description: result.error,
          type: "warning",
        })
      }

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
          <div className="grid gap-4">
            <UserFormFields control={form.control} user={user} isPending={isPending} clearErrors={form.clearErrors} />

            <div className="grid lg:grid-cols-3">
              <div className="lg:col-span-2">
                {/* Organizations card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stores</CardTitle>
                    <CardDescription>Manage this user&apos;s store memberships</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {fields.map((field, index) => {
                      const availableStoreOptions = stores
                        .filter((store) => !selectedStoreIds.some((storeId, i) => i !== index && storeId === store.id))
                        .map((store) => ({ label: store.name, value: store.id }))
                      return (
                        <div key={field.id} className="grid grid-cols-2 items-end gap-4">
                          <SelectField
                            control={form.control}
                            label="Store"
                            name={`stores.${index}.storeId`}
                            options={availableStoreOptions}
                            disabled={isPending || !field.isNew}
                            placeholder="Select Store"
                          />
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              {field.storeRole === "owner" ? (
                                // Show read-only badge for owners
                                <div className="grid gap-1.5">
                                  <p className="text-sm font-medium">Member Role</p>
                                  <div className="flex h-9 items-center">
                                    <Badge variant="default">Owner</Badge>
                                  </div>
                                </div>
                              ) : (
                                <SelectField control={form.control} label="Member Role" name={`stores.${index}.storeRole`} options={storeRoleOptions} disabled={isPending} placeholder="Member" />
                              )}
                            </div>
                            <Button type="button" variant="outline" size="icon" onClick={() => remove(index)} disabled={isPending} className="mb-0.5 shrink-0">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {storesErrorMessage && <FieldError errors={[{ message: storesErrorMessage }]} />}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          memberId: undefined,
                          storeId: stores.find((store) => !selectedStoreIds.includes(store.id))?.id ?? "",
                          storeRole: "member",
                          isNew: true,
                        })
                      }
                      disabled={isPending || fields.length >= stores.length}
                      className="w-full"
                    >
                      <Plus className="size-4" />
                      Add Store
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <SharedFormFooter backTo="/users" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}

export default EditStoreUserForm
