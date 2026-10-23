"use client"

import type { Control, FieldValues, Path } from "react-hook-form"
import { SpecType } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { SPEC_NOT_SET as NOT_SET } from "@/lib/schemas/category-spec.schemas"
import type { SpecField } from "@/types"

// The specs of the product's category and the categories above it. Every one is optional. Values for another
// category's specs stay in the form until it's saved, so switching back keeps them; the action saves only the
// current category's.

const label = (spec: SpecField) => (spec.type === SpecType.NUMBER && spec.unit ? `${spec.name} (${spec.unit})` : spec.name)

export default function ProductSpecs<T extends FieldValues & { specs: Record<string, string | number | undefined> }>({
  control,
  fields,
  hasCategory,
  disabled,
}: {
  control: Control<T>
  fields: SpecField[]
  hasCategory: boolean
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Specifications</CardTitle>
        <CardDescription>Details customers can compare and filter by. They come from the product&apos;s category, and each one is optional.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasCategory ? (
          <p className="text-sm text-muted-foreground">Choose a category to see its specifications.</p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">This category has no specifications. Add them on the category&apos;s page.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((spec) => {
              const name = `specs.${spec.id}` as Path<T>
              switch (spec.type) {
                case SpecType.SELECT:
                  return (
                    <SelectField
                      key={spec.id}
                      control={control}
                      label={label(spec)}
                      name={name}
                      placeholder="Not set"
                      options={[{ value: NOT_SET, label: "Not set" }, ...spec.options.map((option) => ({ value: option.id, label: option.value }))]}
                      disabled={disabled}
                    />
                  )
                case SpecType.BOOLEAN:
                  return (
                    <SelectField
                      key={spec.id}
                      control={control}
                      label={label(spec)}
                      name={name}
                      placeholder="Not set"
                      options={[
                        { value: NOT_SET, label: "Not set" },
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]}
                      disabled={disabled}
                    />
                  )
                case SpecType.NUMBER:
                  // Two decimals: the step is what the field rounds to when it loses focus
                  return <NumberInputField key={spec.id} control={control} label={label(spec)} name={name} step={0.01} min={-1e9} disabled={disabled} />
                case SpecType.TEXT:
                  return <TextInputField key={spec.id} control={control} label={label(spec)} name={name} disabled={disabled} />
              }
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
