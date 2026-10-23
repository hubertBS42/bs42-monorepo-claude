"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { Status } from "@workspace/db/enums"
import { TextareaField } from "@workspace/forms"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import FormDialog from "@/components/form-dialog"
import { declineProductRequestAction, matchProductRequestAction, searchCatalogueProductsAction } from "@/lib/actions/product-request.actions"
import { declineProductRequestFormSchema, matchProductRequestFormSchema, PRODUCT_REQUEST_LIMITS } from "@/lib/schemas/product-request.schemas"
import type { CatalogueProductOption } from "@/types"

// What an admin can do with a pending request: make the product (the add form, filled in from it), link a product the
// catalogue already has, or decline it with a reason. Each refuses NOT_PENDING when someone else got there first.

const REFRESH_ON = ["NOT_PENDING"]

// How long typing pauses before the catalogue is searched
const SEARCH_DELAY_MS = 300

// Catalogue products by name, SKU or barcode, one of which is chosen
function ProductSearch({ value, onChange, disabled, error }: { value: string; onChange: (productId: string) => void; disabled: boolean; error?: string }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CatalogueProductOption[]>([])

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      if (!search.trim()) {
        setResults([])
        return
      }
      searchCatalogueProductsAction({ search })
        .then((response) => {
          if (current && response.success) setResults(response.data)
        })
        .catch((failure) => console.error("Could not search the catalogue:", failure))
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [search])

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="match-search">Product</FieldLabel>
      <Input id="match-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, SKU or barcode" disabled={disabled} autoComplete="off" />
      {results.length > 0 && (
        <ul className="grid max-h-60 gap-1 overflow-y-auto rounded-md border p-1" role="listbox" aria-label="Products">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === product.id}
                disabled={disabled}
                onClick={() => onChange(product.id)}
                className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent", value === product.id && "bg-accent")}
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.status === Status.PUBLISHED ? product.brandName : `${product.brandName} · ${product.status.toLowerCase()}`}</span>
                </span>
                {value === product.id && <Check className="size-4 shrink-0" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <FieldError errors={[{ message: error }]} />}
    </Field>
  )
}

export default function ProductRequestReview({ request }: { request: { id: string; name: string } }) {
  const { data: session, isPending } = consoleAuthClient.useSession()
  if (isPending) return <Skeleton className="h-9 rounded-md" />
  if (!hasSystemPermission(session?.user.role, { product: ["update"] })) return <p className="text-sm text-muted-foreground">Your role can&apos;t review product requests.</p>
  const canCreate = hasSystemPermission(session?.user.role, { product: ["create"] })

  return (
    <div className="grid gap-2">
      {canCreate && (
        <Link href={`/catalogue/products/add?request=${request.id}`} className={buttonVariants()}>
          Add the product
        </Link>
      )}

      <FormDialog
        trigger={
          <Button type="button" variant="outline">
            Already in the catalogue
          </Button>
        }
        title="Link a product that exists"
        description="The store is told which product it is, so it can list it."
        submitLabel="Link it"
        failureTitle="Unable to link the product"
        refreshOn={[...REFRESH_ON, "PRODUCT_NOT_FOUND"]}
        schema={matchProductRequestFormSchema}
        values={{ productId: "" }}
        save={(values) => matchProductRequestAction({ ...values, requestId: request.id })}
        success={() => ({ title: "Request answered", description: "The store has been told which product it is." })}
      >
        {(form, saving) => (
          <ProductSearch
            value={form.watch("productId")}
            onChange={(productId) => form.setValue("productId", productId, { shouldValidate: true, shouldDirty: true })}
            disabled={saving}
            error={form.formState.errors.productId?.message}
          />
        )}
      </FormDialog>

      <FormDialog
        trigger={
          <Button type="button" variant="outline">
            Decline
          </Button>
        }
        title="Decline the request"
        description="The person who asked is told the reason."
        submitLabel="Decline"
        failureTitle="Unable to decline the request"
        refreshOn={REFRESH_ON}
        destructive
        schema={declineProductRequestFormSchema}
        values={{ reason: "" }}
        save={(values) => declineProductRequestAction({ ...values, requestId: request.id })}
        success={() => ({ title: "Request declined", description: `The store has been told why ${request.name} won't be added.` })}
      >
        {(form, saving) => (
          <TextareaField
            control={form.control}
            label="Reason"
            name="reason"
            placeholder="e.g. We can't source this model in Ghana"
            showCount
            maxLength={PRODUCT_REQUEST_LIMITS.reason}
            disabled={saving}
          />
        )}
      </FormDialog>
    </div>
  )
}
