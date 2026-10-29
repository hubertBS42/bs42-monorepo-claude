"use client"

import TextInputField from "@workspace/forms/components/text-input-field"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import type { UserDetails } from "@/types"
import { isBanActive, RoleBadges, UserStatusBadge } from "@/components/user-badges"
import { formatDate } from "@workspace/utils/date"
import { Control, FieldValues, Path, UseFormClearErrors } from "react-hook-form"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import ImageField from "@workspace/forms/components/image-field"
import Addresses from "./addresses"
import AddAddressDialog from "./addresses/add-address-dialog"
import DateField from "@workspace/forms/components/date-field"
import SwitchField from "@workspace/forms/components/switch-field"
import PhoneField from "@workspace/forms/components/phone-field"
import { deleteImages, uploadImages } from "@/lib/storage"
import UserActions from "./user-actions"

interface UserFormFieldsProps<T extends FieldValues> {
  control: Control<T>
  user: UserDetails
  isPending: boolean
  clearErrors: UseFormClearErrors<T>
}

const UserFormFields = <T extends FieldValues>({ control, user, isPending, clearErrors }: UserFormFieldsProps<T>) => {
  const handleAddAvatar = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveAvatar = async (url: string) => {
    // The saved avatar is deleted by the form after a successful save, so leaving without saving keeps it intact
    if (url === user.image) return
    await deleteImages([url])
  }

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-3">
      <div className="grid gap-4 lg:col-span-2">
        {/* Details card */}
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>Basic information about the user.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-5">
            <div className="col-span-2 grid">
              <ImageField
                control={control}
                name={"image" as Path<T>}
                sizeLimit={100}
                maxImages={1}
                onAdd={handleAddAvatar}
                onRemove={handleRemoveAvatar}
                clearErrors={clearErrors}
                label="Avatar"
                disabled={isPending}
                className="max-w-35"
                defaultValues={user.image}
              />
            </div>
            <div className="col-span-2 grid">
              <TextInputField control={control} label="Full Name" name={"name" as Path<T>} disabled={isPending} />
            </div>
            <div className="col-span-2 grid lg:col-span-1">
              <TextInputField control={control} label="Email" name={"email" as Path<T>} type="email" disabled />
            </div>
            <div className="col-span-2 grid lg:col-span-1">
              <PhoneField control={control} label="Phone" name={"phone" as Path<T>} disabled={isPending} defaultCountry="GH" />
            </div>

            <div className="col-span-2 grid lg:col-span-1">
              <DateField control={control} name={"dob" as Path<T>} label="Date of birth" disabled={isPending} disabledDates={(date) => date > new Date() || date < new Date("1900-01-01")} captionLayout="dropdown" startMonth={new Date(1900, 0)} endMonth={new Date()} />
            </div>
            <div className="col-span-2 grid lg:col-span-1">
              {/* Rendered from props, so it updates after a promote or demote refreshes the page */}
              <Field className="gap-y-1">
                <FieldLabel>System Role</FieldLabel>
                <div className="flex h-9 items-center">
                  <RoleBadges role={user.role} />
                </div>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
            <CardDescription>Delivery addresses saved for this user.</CardDescription>
          </CardHeader>
          <CardContent>
            <Addresses addresses={user.addresses} />
          </CardContent>
          <CardFooter className="justify-center border-t p-4">
            <AddAddressDialog userId={user.id} />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Settings for this user.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-3">
              <SwitchField
                control={control}
                name={"getMarketingEmails" as Path<T>}
                label="Marketing emails"
                description="Receive emails about new products and more."
                disabled={isPending}
                variant="card"
              />
              <SwitchField control={control} name={"getSecurityEmails" as Path<T>} label="Security emails" description="Receive emails about account security." disabled={isPending} variant="card" />
              <SwitchField control={control} name={"getOrderEmails" as Path<T>} label="Order emails" description="Receive emails about order updates." disabled={isPending} variant="card" />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        {/* Status card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Status
              <UserStatusBadge user={user} />
            </CardTitle>
          </CardHeader>
          {isBanActive(user) && (
            <CardContent>
              <div className="grid gap-y-5 text-sm">
                <div>
                  <h3 className="font-medium">Ban Reason:</h3>
                  <p className="text-muted-foreground">{user.banReason || "No reason given"}</p>
                </div>
                <div>
                  <h3 className="font-medium">Ban Expiration:</h3>
                  <p className="text-muted-foreground">{user.banExpires ? formatDate(user.banExpires, "LLL dd, y") : "Never"}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Actions card */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Perform actions on this user.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserActions user={user} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default UserFormFields
