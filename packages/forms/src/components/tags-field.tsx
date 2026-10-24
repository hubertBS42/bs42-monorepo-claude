"use client"

import * as React from "react"
import { X } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import {
  Field,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import FieldLabelWithInfo from "./field-label-with-info"

interface TagsFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  maxTags?: number
  autoComplete?: string
}

function getTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((tag): tag is string => typeof tag === "string")
}

const TagsField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  description,
  info,
  placeholder = "Add tag...",
  disabled = false,
  className,
  maxTags,
  autoComplete = "off",
}: TagsFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = React.useState("")
  const [inputError, setInputError] = React.useState<string | null>(null)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const tags = getTags(field.value)
        const isAtLimit = maxTags !== undefined && tags.length >= maxTags
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid || inputError ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        const addTags = (values: string[]) => {
          const candidates = values.map((value) => value.trim()).filter(Boolean)
          if (candidates.length === 0) return

          const nextTags = [...tags]
          const existingTags = new Set(
            tags.map((tag) => tag.toLocaleLowerCase())
          )
          let hitLimit = false

          for (const tag of candidates) {
            const normalizedTag = tag.toLocaleLowerCase()
            if (existingTags.has(normalizedTag)) continue
            if (maxTags !== undefined && nextTags.length >= maxTags) {
              hitLimit = true
              break
            }

            existingTags.add(normalizedTag)
            nextTags.push(tag)
          }

          if (nextTags.length !== tags.length) field.onChange(nextTags)
          setInputError(hitLimit ? `You can add up to ${maxTags} tags.` : null)
          setInputValue("")
        }

        const removeTag = (index: number) => {
          field.onChange(tags.filter((_, tagIndex) => tagIndex !== index))
          setInputError(null)
          inputRef.current?.focus()
        }

        const handleKeyDown = (
          event: React.KeyboardEvent<HTMLInputElement>
        ) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return

          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            addTags([inputValue])
          } else if (
            event.key === "Backspace" &&
            inputValue.length === 0 &&
            tags.length > 0
          ) {
            event.preventDefault()
            field.onChange(tags.slice(0, -1))
          }
        }

        const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
          const pastedText = event.clipboardData.getData("text")
          if (!/[,\r\n]/.test(pastedText)) return

          event.preventDefault()
          const pastedTags = pastedText
            .split(/[,\r\n]+/)
            .map((tag) => tag.trim())
            .filter(Boolean)
          addTags([inputValue, ...pastedTags])
        }

        const handleInputChange = (
          event: React.ChangeEvent<HTMLInputElement>
        ) => {
          setInputValue(event.target.value)
          if (inputError) setInputError(null)
        }

        return (
          <Field
            className="grid gap-1"
            data-disabled={disabled}
            data-invalid={fieldState.invalid || Boolean(inputError)}
          >
            {label && (
              <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
            )}

            <div
              className={cn(
                "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1.5 shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                (fieldState.invalid || inputError) &&
                  "border-destructive focus-within:ring-destructive/30",
                disabled && "cursor-not-allowed opacity-50",
                className
              )}
              onClick={(event) => {
                if (event.target === event.currentTarget)
                  inputRef.current?.focus()
              }}
            >
              {tags.map((tag, index) => (
                <Badge
                  key={`${tag.toLocaleLowerCase()}-${index}`}
                  variant="secondary"
                  // text-sm like the input, with no vertical padding so the badge stays 22px and the field 36px
                  className="h-auto max-w-full gap-1 py-0 text-sm whitespace-normal"
                >
                  <span className="break-all">{tag}</span>
                  {!disabled && (
                    <button
                      type="button"
                      className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${tag}`}
                      onClick={() => removeTag(index)}
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}

              <Input
                {...field}
                ref={(element) => {
                  inputRef.current = element
                  field.ref(element)
                }}
                id={inputId}
                value={inputValue}
                placeholder={isAtLimit ? "" : placeholder}
                autoComplete={autoComplete}
                disabled={disabled || isAtLimit}
                aria-invalid={fieldState.invalid || Boolean(inputError)}
                aria-describedby={describedBy}
                aria-label={
                  label ? `Add ${label.toLocaleLowerCase()}` : "Add tag"
                }
                className="h-auto min-w-24 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={() => {
                  if (inputValue.trim()) addTags([inputValue])
                  field.onBlur()
                }}
              />
            </div>

            {description && (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            )}
            {(fieldState.invalid || inputError) && (
              <FieldError id={errorId}>
                {inputError ?? fieldState.error?.message}
              </FieldError>
            )}
          </Field>
        )
      }}
    />
  )
}

export default TagsField
