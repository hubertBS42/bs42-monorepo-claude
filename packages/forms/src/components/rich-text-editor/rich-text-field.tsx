"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"
import type { Editor } from "@tiptap/react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import RichTextEditor from "./index"

interface RichTextFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  description?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

const RichTextField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  description,
  placeholder,
  disabled = false,
  className,
}: RichTextFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const editorRef = React.useRef<Editor | null>(null)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        return (
          <Field
            className={className ?? "grid gap-1"}
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && (
              <FieldLabel
                htmlFor={inputId}
                // A contenteditable <div> isn't a "labelable" element per the
                // HTML spec, so clicking a <label htmlFor> won't focus it
                // automatically like it would an <input>/<textarea>.
                onClick={(event) => {
                  event.preventDefault()
                  editorRef.current?.commands.focus()
                }}
              >
                {label}
              </FieldLabel>
            )}

            <RichTextEditor
              id={inputId}
              value={field.value}
              disabled={disabled}
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy}
              onChange={field.onChange}
              onBlur={field.onBlur}
              onEditorInit={(editor) => {
                editorRef.current = editor
                // Let RHF's setFocus(name) focus the editor on validation
                // errors, since the underlying node is a contenteditable
                // div rather than a form element.
                field.ref({
                  focus: () => editor?.commands.focus(),
                })
              }}
            />

            {description && (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            )}
            {fieldState.invalid && (
              <FieldError id={errorId} errors={[fieldState.error]} />
            )}
          </Field>
        )
      }}
    />
  )
}

export default RichTextField
