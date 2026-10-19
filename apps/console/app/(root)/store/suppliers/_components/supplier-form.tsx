"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { SwitchField, TextareaField, TextInputField } from "@workspace/forms"
import PhoneField from "@workspace/forms/components/phone-field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { toast } from "@workspace/ui/components/toast"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { createSupplierAction, updateSupplierAction } from "@/lib/actions/supplier.actions"
import { supplierEditFormSchema } from "@/lib/schemas/supplier.schemas"
import type { SupplierDetails } from "@/types"
import DeleteSupplier from "./delete-supplier"

// One form for adding and editing
type FormInput = z.input<typeof supplierEditFormSchema>
type FormOutput = z.output<typeof supplierEditFormSchema>

interface SupplierFormProps {
  storeId: string
  // Null when adding
  supplier: SupplierDetails | null
}

const BACK_TO = "/store/suppliers"

export default function SupplierForm({ storeId, supplier }: SupplierFormProps) {
  const router = useRouter()
  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading.
  // This keeps the form locked from a successful save until the page changes.
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(supplierEditFormSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contactName: supplier?.contactName ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
      address: supplier?.address ?? "",
      notes: supplier?.notes ?? "",
      isArchived: supplier?.isArchived ?? false,
    },
  })

  const onSubmit: SubmitHandler<FormOutput> = async ({ isArchived, ...data }) => {
    const response = supplier ? await updateSupplierAction({ ...data, isArchived, storeId, id: supplier.id }) : await createSupplierAction({ ...data, storeId })

    if (!response.success) {
      if (response.code === "NAME_EXISTS") form.setError("name", { type: "custom", message: response.error })
      else toast.add({ title: "Unable to save the supplier", description: response.error, type: "error" })
      return
    }

    setIsSaved(true)
    router.push(BACK_TO)
    toast.add({
      title: supplier ? "Supplier updated" : "Supplier added",
      description: supplier ? "Your changes have been saved." : `${data.name} can now be chosen on purchase orders.`,
      type: "success",
    })
  }

  const isBusy = form.formState.isSubmitting || isSaved

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading={supplier ? "Edit Supplier" : "Add Supplier"}
          description={supplier ? `Edit ${supplier.name}.` : "Someone this store buys its stock from."}
          backTo={BACK_TO}
          isPending={isBusy}
          isDirty={form.formState.isDirty}
          handleDiscard={() => router.push(BACK_TO)}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Supplier Details</CardTitle>
                  <CardDescription>Who they are and how to reach them.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInputField control={form.control} label="Contact person" name="contactName" disabled={isBusy} placeholder="Optional" />
                      <TextInputField control={form.control} label="Email" name="email" type="email" disabled={isBusy} placeholder="Optional" />
                    </div>
                    <PhoneField control={form.control} label="Phone" name="phone" disabled={isBusy} defaultCountry="GH" />
                    <TextareaField control={form.control} label="Address" name="address" disabled={isBusy} placeholder="Optional" />
                    <TextareaField control={form.control} label="Notes" name="notes" disabled={isBusy} placeholder="Payment terms, account numbers, lead times…" />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            {supplier && (
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Status</CardTitle>
                    <CardDescription>An archived supplier stays on its purchase orders but can&apos;t be chosen for new ones.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SwitchField control={form.control} label="Archived" name="isArchived" disabled={isBusy} variant="card" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>Delete this supplier. One that is on purchase orders can only be archived.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DeleteSupplier storeId={storeId} supplier={supplier} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <SharedFormFooter backTo={BACK_TO} isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={() => router.push(BACK_TO)} />
        </div>
      </div>
    </form>
  )
}
