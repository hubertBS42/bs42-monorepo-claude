"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import * as z from "zod"

import type { DocumentItem } from "@workspace/contracts"
import {
  CascaderField,
  ComboboxField,
  DateField,
  DocumentField,
  ImageField,
  NumberInputField,
  PasswordField,
  PhoneField,
  RichTextField,
  SelectField,
  SelectTreeField,
  SwitchField,
  TagsField,
  TextareaField,
  TextInputField,
  type CascaderOption,
  type TreeSelectOption,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { deleteDocuments, deleteImages, uploadDocuments, uploadImages } from "@/lib/storage"

const documentItemSchema = z.object({
  name: z.string(),
  url: z.string(),
}) satisfies z.ZodType<DocumentItem>

const categoryOptions: CascaderOption[] = [
  {
    label: "Clothing",
    value: "clothing",
    children: [
      {
        label: "Men",
        value: "clothing-men",
        children: [
          { label: "Shirts", value: "clothing-men-shirts" },
          { label: "Trousers", value: "clothing-men-trousers" },
        ],
      },
      {
        label: "Women",
        value: "clothing-women",
        children: [
          { label: "Dresses", value: "clothing-women-dresses" },
          { label: "Skirts", value: "clothing-women-skirts" },
        ],
      },
    ],
  },
  {
    label: "Electronics",
    value: "electronics",
    children: [
      { label: "Phones", value: "electronics-phones" },
      { label: "Laptops", value: "electronics-laptops" },
    ],
  },
  { label: "Home & Garden", value: "home-garden" },
]

const departmentOptions: TreeSelectOption[] = [
  {
    label: "Engineering",
    value: "engineering",
    children: [
      { label: "Frontend", value: "frontend" },
      { label: "Backend", value: "backend" },
      { label: "Platform", value: "platform" },
    ],
  },
  {
    label: "Sales",
    value: "sales",
    children: [
      { label: "Enterprise", value: "enterprise" },
      { label: "SMB", value: "smb" },
    ],
  },
  { label: "People Operations", value: "people-operations" },
]

const formComponentsSchema = z.object({
  fullName: z.string().min(2, "Enter at least 2 characters."),
  email: z.email("Enter a valid email address."),
  phone: z
    .string()
    .min(1, "Enter a phone number.")
    .regex(/^\+[1-9]\d{6,14}$/, "Enter a phone number in international format."),
  password: z.string().min(8, "Use at least 8 characters."),
  role: z.string().min(1, "Choose a role."),
  country: z.string().min(1, "Choose a country."),
  category: z.string().min(1, "Choose a category."),
  department: z.string().min(1, "Choose a department."),
  notifications: z.boolean(),
  marketingEmails: z.boolean(),
  date: z.date().nullable(),
  images: z.array(z.string()).max(3, "You can upload up to 3 images."),
  documents: z.array(documentItemSchema).max(3, "You can attach up to 3 documents."),
  tags: z.array(z.string()).max(5, "You can add up to 5 tags."),
  quantity: z.number().min(1, "Enter at least 1.").max(100, "Enter no more than 100."),
  notes: z.string().min(10, "Enter at least 10 characters."),
  description: z.string().nullable(),
})

type FormComponentsValues = z.infer<typeof formComponentsSchema>

const defaultValues: FormComponentsValues = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  role: "",
  country: "",
  category: "",
  department: "",
  notifications: false,
  marketingEmails: false,
  date: null,
  images: [],
  documents: [],
  tags: [],
  quantity: 1,
  notes: "",
  description: null,
}

export function FormComponentsDemo() {
  const [submitted, setSubmitted] = useState(false)
  const form = useForm<FormComponentsValues>({
    resolver: zodResolver(formComponentsSchema),
    defaultValues,
  })

  const handleAddImages = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveImage = async (url: string) => {
    await deleteImages([url])
  }

  const handleAddDocuments = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadDocuments(formData)
  }

  const handleRemoveDocument = async (url: string) => {
    await deleteDocuments([url])
  }

  const onSubmit: SubmitHandler<FormComponentsValues> = async () => {
    setSubmitted(true)
  }

  const resetForm = () => {
    form.reset(defaultValues)
    setSubmitted(false)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Shared forms package</p>
        <h1 className="text-3xl font-semibold tracking-tight">Form components</h1>
        <p className="max-w-2xl text-muted-foreground">
          Interactive examples of each shared React Hook Form field. Submit the form to see validation, or reset it to start over.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup className="gap-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Text input</CardTitle>
                <CardDescription>Text and email inputs with labels, hints, and validation.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-y-4">
                  <TextInputField
                    control={form.control}
                    name="fullName"
                    label="Full name"
                    placeholder="Alex Morgan"
                    description="Enter your first and last name."
                  />
                  <TextInputField control={form.control} name="email" label="Email" type="email" placeholder="alex@example.com" />
                  <PhoneField
                    control={form.control}
                    name="phone"
                    label="Phone number"
                    description="Enter a number with its country calling code."
                    defaultCountry="US"
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Toggle visibility and validate a password value.</CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordField
                  control={form.control}
                  name="password"
                  label="Password"
                  placeholder="Enter a password"
                  description="Use at least 8 characters."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Select</CardTitle>
                <CardDescription>Choose an option from the shared select field.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectField
                  control={form.control}
                  name="role"
                  label="Role"
                  placeholder="Choose a role"
                  description="This is a demo selection; it is not saved."
                  options={[
                    { value: "administrator", label: "Administrator" },
                    { value: "manager", label: "Manager" },
                    { value: "member", label: "Member" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Number input</CardTitle>
                <CardDescription>Enter a value or use the stepper controls.</CardDescription>
              </CardHeader>
              <CardContent>
                <NumberInputField
                  control={form.control}
                  name="quantity"
                  label="Quantity"
                  min={1}
                  max={100}
                  step={1}
                  description="Allowed range: 1–100."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Combobox</CardTitle>
                <CardDescription>Search options by label and select a value.</CardDescription>
              </CardHeader>
              <CardContent>
                <ComboboxField
                  control={form.control}
                  name="country"
                  label="Country"
                  placeholder="Choose a country"
                  description="Search by country name; the form stores its code."
                  options={[
                    { value: "ca", label: "Canada" },
                    { value: "jp", label: "Japan" },
                    { value: "gb", label: "United Kingdom" },
                    { value: "us", label: "United States" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cascader</CardTitle>
                <CardDescription>Drill into nested categories, or search across every level.</CardDescription>
              </CardHeader>
              <CardContent>
                <CascaderField
                  control={form.control}
                  name="category"
                  label="Category"
                  placeholder="Choose a category"
                  description="Only leaf categories are selectable."
                  options={categoryOptions}
                  clearable
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tree select</CardTitle>
                <CardDescription>Choose from a flattened, indented hierarchy in a single dropdown.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectTreeField
                  control={form.control}
                  name="department"
                  label="Department"
                  placeholder="Choose a department"
                  description="Department groups are shown for context, but are not selectable."
                  options={departmentOptions}
                  branchesSelectable={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Switch card</CardTitle>
                <CardDescription>A labeled switch styled as a bordered card row.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <SwitchField
                  control={form.control}
                  name="notifications"
                  variant="card"
                  label="Email notifications"
                  description="Receive updates about your account by email."
                />
                <SwitchField
                  control={form.control}
                  name="marketingEmails"
                  label="Send me marketing emails"
                  description="A compact switch and label, without the card styling."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date</CardTitle>
                <CardDescription>Choose a date, navigate between months, or clear the value.</CardDescription>
              </CardHeader>
              <CardContent>
                <DateField control={form.control} name="date" label="Date" description="Choose a date, or clear it to leave this optional." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Add tags with Enter or commas, paste a comma-separated list, or remove them individually.</CardDescription>
              </CardHeader>
              <CardContent>
                <TagsField
                  control={form.control}
                  name="tags"
                  label="Product tags"
                  description="Up to five unique tags. Tag matching ignores case."
                  placeholder="e.g. handmade"
                  maxTags={5}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Document upload</CardTitle>
                <CardDescription>Attach up to three PDFs and remove them individually.</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentField
                  control={form.control}
                  name="documents"
                  label="PDF documents"
                  description="PDFs are uploaded to Azure Storage and can be removed individually."
                  accept=".pdf,application/pdf"
                  maxFiles={3}
                  sizeLimit={5_120}
                  clearErrors={form.clearErrors}
                  onAdd={handleAddDocuments}
                  onRemove={handleRemoveDocument}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Image upload</CardTitle>
                <CardDescription>Add up to three image previews, then remove them individually.</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageField
                  control={form.control}
                  name="images"
                  label="Images"
                  description="Demo-only: selected files are previewed locally and are not uploaded."
                  maxImages={3}
                  sizeLimit={2048}
                  clearErrors={form.clearErrors}
                  onAdd={handleAddImages}
                  onRemove={handleRemoveImage}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Textarea</CardTitle>
                <CardDescription>A multiline field with validation feedback.</CardDescription>
              </CardHeader>
              <CardContent>
                <TextareaField
                  control={form.control}
                  name="notes"
                  label="Notes"
                  placeholder="Add a few details..."
                  rows={4}
                  description="Enter at least 10 characters."
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Rich text editor</CardTitle>
                <CardDescription>A TipTap-based editor for long-form content, such as product descriptions.</CardDescription>
              </CardHeader>
              <CardContent>
                <RichTextField
                  control={form.control}
                  name="description"
                  label="Description"
                  placeholder="Describe the product..."
                  description="Optional. Formatting is preserved as rich text."
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Validate form
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset
            </Button>
            {submitted && (
              <p role="status" className="text-sm text-muted-foreground">
                All fields are valid. No data was submitted or saved.
              </p>
            )}
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}
