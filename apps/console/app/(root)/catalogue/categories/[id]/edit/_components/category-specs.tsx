"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { ArrowDown, ArrowUp, ListChecks, Pencil, PlusCircle, Trash2, X } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { SpecType } from "@workspace/db/enums"
import { SelectField, SwitchField, TextInputField } from "@workspace/forms"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import FormDialog from "@/components/form-dialog"
import { createCategorySpecAction, deleteCategorySpecAction, moveCategorySpecAction, updateCategorySpecAction } from "@/lib/actions/category-spec.actions"
import { categorySpecFormSchema } from "@/lib/schemas/category-spec.schemas"
import type { CategorySpecRow, CategorySpecsData, SpecField } from "@/types"
import { EmptyState } from "@workspace/ui/components/empty-state"

// The category's specifications, below its form: each change saves on its own, like the exchange-rate card on Settings

type SpecFormInput = z.input<typeof categorySpecFormSchema>

// The spec changed or went under the page: show it as it is now
const REFRESH_CODES = ["CONFLICT", "NOT_FOUND"]

const SPEC_TYPE_LABELS: Record<SpecType, string> = {
  SELECT: "Choice",
  NUMBER: "Number",
  BOOLEAN: "Yes / no",
  TEXT: "Text",
}
const SPEC_TYPE_OPTIONS = Object.values(SpecType).map((value) => ({ value, label: SPEC_TYPE_LABELS[value] }))

const NEW_SPEC: SpecFormInput = { name: "", type: SpecType.SELECT, unit: "", isFilterable: true, options: [] }

// "Choice: 2MP, 4MP, 8MP" or "Number (m)"
function describeSpec(spec: SpecField) {
  if (spec.type === SpecType.SELECT) {
    const shown = spec.options.slice(0, 4).map((option) => option.value)
    return `${SPEC_TYPE_LABELS.SELECT}: ${shown.join(", ")}${spec.options.length > shown.length ? `, +${spec.options.length - shown.length}` : ""}`
  }
  return spec.type === SpecType.NUMBER && spec.unit ? `${SPEC_TYPE_LABELS.NUMBER} (${spec.unit})` : SPEC_TYPE_LABELS[spec.type]
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export default function CategorySpecs({ categoryId, specs }: { categoryId: string; specs: CategorySpecsData }) {
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()
  // hasSystemPermission, not checkRolePermission: roles can be comma-separated. The actions check again.
  const canEdit = hasSystemPermission(session?.user.role, { category: ["update"] })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Specifications</CardTitle>
        <CardDescription>Details products here and in subcategories can list, like a camera&apos;s resolution.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {specs.inherited.length > 0 && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">From the categories above:</p>
            <ul className="flex flex-wrap gap-2">
              {specs.inherited.map((spec) => (
                <li key={spec.id}>
                  <Badge variant="secondary">
                    {spec.name} · {spec.categoryName}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {specs.own.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Filter</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {specs.own.map((spec, index) => (
                <TableRow key={spec.id}>
                  <TableCell className="font-medium">{spec.name}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{describeSpec(spec)}</TableCell>
                  <TableCell>{spec.isFilterable ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right tabular-nums">{spec.productCount}</TableCell>
                  <TableCell>
                    {isSessionLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      canEdit && (
                        <div className="flex justify-end gap-1">
                          <MoveSpec spec={spec} direction="up" disabled={index === 0} />
                          <MoveSpec spec={spec} direction="down" disabled={index === specs.own.length - 1} />
                          <SpecDialog categoryId={categoryId} spec={spec} />
                          <DeleteSpec spec={spec} />
                        </div>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={ListChecks} title="No specifications of its own" description="Add what its products can list, like a camera's resolution." />
        )}

        {isSessionLoading ? (
          <Skeleton className="h-9 w-40 rounded-md" />
        ) : canEdit ? (
          <div>
            <SpecDialog categoryId={categoryId} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Your role cannot change specifications.</p>
        )}
      </CardContent>
    </Card>
  )
}

// Adds a spec, or edits one when given it
function SpecDialog({ categoryId, spec }: { categoryId: string; spec?: CategorySpecRow }) {
  const values: SpecFormInput = spec
    ? { name: spec.name, type: spec.type, unit: spec.unit ?? "", isFilterable: spec.isFilterable, options: spec.options.map(({ id, value }) => ({ id, value })) }
    : NEW_SPEC

  return (
    <FormDialog
      trigger={
        spec ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${spec.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm">
            <PlusCircle />
            Add specification
          </Button>
        )
      }
      title={spec ? `Edit ${spec.name}` : "Add specification"}
      description={spec ? "Renamed options stay on products; removed ones are cleared." : "Optional for products here and in subcategories."}
      submitLabel={spec ? "Save" : "Add"}
      failureTitle={spec ? "Unable to save the specification" : "Unable to add the specification"}
      refreshOn={REFRESH_CODES}
      className="sm:max-w-lg"
      schema={categorySpecFormSchema}
      values={values}
      save={(submitted) => (spec ? updateCategorySpecAction({ id: spec.id, updatedAt: spec.updatedAt, spec: submitted }) : createCategorySpecAction({ categoryId, spec: submitted }))}
      success={(submitted) => ({ title: spec ? "Specification saved" : "Specification added", description: spec ? `${submitted.name} has been updated.` : `${submitted.name} has been added.` })}
    >
      {(form, isPending) => <SpecFields form={form} isPending={isPending} isEditing={!!spec} />}
    </FormDialog>
  )
}

function SpecFields({ form, isPending, isEditing }: { form: UseFormReturn<SpecFormInput, unknown, z.output<typeof categorySpecFormSchema>>; isPending: boolean; isEditing: boolean }) {
  const type = useWatch({ control: form.control, name: "type" })

  return (
    <>
      <TextInputField control={form.control} label="Name" name="name" placeholder="e.g. Resolution" disabled={isPending} />
      <SelectField control={form.control} label="Type" name="type" options={SPEC_TYPE_OPTIONS} disabled={isPending || isEditing} description={isEditing ? "Can't change once created." : undefined} />
      {type === SpecType.NUMBER && <TextInputField control={form.control} label="Unit" name="unit" placeholder="e.g. m, MP, W" description="Optional. Shown after the number." disabled={isPending} />}
      {type === SpecType.SELECT && <SpecOptions form={form} disabled={isPending} />}
      <SwitchField control={form.control} variant="card" label="Use as a filter" name="isFilterable" description="Customers can filter by it" disabled={isPending} />
    </>
  )
}

function SpecOptions({ form, disabled }: { form: UseFormReturn<SpecFormInput, unknown, z.output<typeof categorySpecFormSchema>>; disabled: boolean }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options", keyName: "key" })
  const error = form.formState.errors.options

  return (
    <div className="grid gap-2">
      <Label>Options</Label>
      {fields.map((field, index) => (
        <div key={field.key} className="flex items-start gap-2">
          <div className="flex-1">
            <TextInputField control={form.control} name={`options.${index}.value`} aria-label={`Option ${index + 1}`} placeholder="e.g. 4MP" disabled={disabled} />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove option" disabled={disabled} onClick={() => remove(index)}>
            <X />
          </Button>
        </div>
      ))}
      {(error?.message ?? error?.root?.message) && <p className="text-sm text-destructive">{error?.message ?? error?.root?.message}</p>}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => append({ value: "" })}>
          <PlusCircle />
          Add option
        </Button>
      </div>
    </div>
  )
}

function MoveSpec({ spec, direction, disabled }: { spec: CategorySpecRow; direction: "up" | "down"; disabled: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const move = () => {
    startTransition(async () => {
      const response = await moveCategorySpecAction({ id: spec.id, direction })
      if (!response.success) toast.add({ title: "Unable to move the specification", description: response.error, type: "error" })
      router.refresh()
    })
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${spec.name} ${direction}`} disabled={disabled || isPending} onClick={move}>
      {isPending ? <Spinner /> : direction === "up" ? <ArrowUp /> : <ArrowDown />}
    </Button>
  )
}

function DeleteSpec({ spec }: { spec: CategorySpecRow }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteCategorySpecAction({ id: spec.id })
      if (!response.success) {
        toast.add({ title: "Unable to delete the specification", description: response.error, type: "error" })
        if (response.code === "NOT_FOUND") {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ title: "Specification deleted", description: `${spec.name} has been deleted.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${spec.name}`}>
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete ${spec.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {spec.productCount > 0
              ? `${plural(spec.productCount, "product has", "products have")} a value for it, which will be removed. This can't be undone.`
              : "No product has a value for it yet. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
