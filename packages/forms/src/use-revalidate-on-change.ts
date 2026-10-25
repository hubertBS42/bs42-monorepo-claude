"use client"

import { useEffect, useRef } from "react"
import { useFormState, type FieldErrors, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form"

// The paths of the fields holding an error ("customerEmail", "items.0.quantity"). A field's error has a `type`; an
// array's own error sits under `root`, which belongs to the array's path. The form's own "root" error (a server
// message) isn't a field's, so it's left alone.
function errorPaths(errors: FieldErrors, prefix = ""): string[] {
  return Object.entries(errors).flatMap(([key, error]) => {
    if (!error || typeof error !== "object") return []
    if (key === "root") return prefix ? [prefix.slice(0, -1)] : []
    if ("type" in error && typeof error.type === "string") return [`${prefix}${key}`]
    return errorPaths(error as FieldErrors, `${prefix}${key}.`)
  })
}

/**
 * While the form shows an error, checks a field again whenever it changes, typed or set in code (`setValue`), with
 * the fields already showing errors, so one fixed by another (a refine across fields) clears too. react-hook-form
 * does this only after a submit and only for typing, so a wizard that checks each step with `trigger()`, or a field
 * filled in from a lookup or an address, would otherwise keep an error that has been fixed.
 */
export function useRevalidateOnChange<T extends FieldValues, C, O>(form: UseFormReturn<T, C, O>) {
  // Subscribed here: form.formState.errors is only kept up to date when something reads it while rendering, and in
  // these forms only the fields read their own errors
  const { errors } = useFormState({ control: form.control })
  const errorsRef = useRef(errors)
  useEffect(() => {
    errorsRef.current = errors
  }, [errors])

  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (!name) return
      const shown = errorPaths(errorsRef.current)
      if (shown.length === 0) return
      void form.trigger([...new Set([name, ...shown])] as FieldPath<T>[])
    })
    return () => subscription.unsubscribe()
  }, [form])
}
