"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Package, Plus, Puzzle, X } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { Status } from "@workspace/db/enums"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { addPairingAction, movePairingAction, removePairingAction, searchPairableProductsAction } from "@/lib/actions/pairing.actions"
import { catalogueProductHref } from "@/lib/product-links"
import type { CatalogueProductOption, PairingItem, PairingOwner, PairingsData } from "@/types"

// "Pairs well with", below a category's or a product's edit form: each change saves on its own, like Specifications.
// On the product form it sits inside the form's element, so its buttons are type="button" and Enter in its search
// doesn't submit the product.

// Matches MAX_PAIRINGS in lib/data/pairings.data.ts (a server-only module)
const MAX_PAIRINGS = 8
// How long typing pauses before the catalogue is searched
const SEARCH_DELAY_MS = 300

function ProductThumb({ image }: { image: string | null }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
      {image ? <img src={image} alt="" className="size-full object-contain p-0.5" /> : <Package className="size-4 text-muted-foreground/50" aria-hidden />}
    </div>
  )
}

function ItemLine({ item }: { item: PairingItem }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <ProductThumb image={item.image} />
      <div className="grid min-w-0">
        <Link href={catalogueProductHref(item.productId)} className="truncate text-sm font-medium hover:underline">
          {item.name}
        </Link>
        {/* Only what's on sale shows on the storefront: say when this one isn't published */}
        <span className="truncate text-xs text-muted-foreground">{item.status === Status.PUBLISHED ? item.brandName : `${item.brandName} · ${item.status.toLowerCase()}, not shown`}</span>
      </div>
    </div>
  )
}

function useChange(errorTitle: string) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const run = (change: () => Promise<{ success: boolean; error?: string }>, onDone?: () => void) => {
    startTransition(async () => {
      const response = await change()
      if (!response.success) toast.add({ title: errorTitle, description: response.error, type: "error" })
      else onDone?.()
      // The list as it is now, whatever happened (someone else may have changed it)
      router.refresh()
    })
  }
  return { isPending, run }
}

function ItemActions({ owner, item, isFirst, isLast }: { owner: PairingOwner; item: PairingItem; isFirst: boolean; isLast: boolean }) {
  const move = useChange("Unable to move the product")
  const remove = useChange("Unable to remove the product")
  const busy = move.isPending || remove.isPending

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${item.name} up`}
        disabled={isFirst || busy}
        onClick={() => move.run(() => movePairingAction({ owner, id: item.id, direction: "up" }))}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${item.name} down`}
        disabled={isLast || busy}
        onClick={() => move.run(() => movePairingAction({ owner, id: item.id, direction: "down" }))}
      >
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.name}`} disabled={busy} onClick={() => remove.run(() => removePairingAction({ owner, id: item.id }))}>
        {remove.isPending ? <Spinner /> : <X />}
      </Button>
    </div>
  )
}

// Catalogue products by name, SKU or barcode; choosing one adds it
function AddProduct({ owner, listed }: { owner: PairingOwner; listed: Set<string> }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CatalogueProductOption[] | null>(null)
  const add = useChange("Unable to add the product")
  // The owner is a new object on every render: the search runs again only when it names another list
  const { kind, id } = owner

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      if (!search.trim()) {
        setResults(null)
        return
      }
      searchPairableProductsAction({ owner: { kind, id }, search })
        .then((response) => {
          if (current && response.success) setResults(response.data)
        })
        .catch((failure) => console.error("Could not search the catalogue:", failure))
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [search, kind, id])

  return (
    <div className="grid gap-2">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        // Inside the product form: Enter would save the product
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        placeholder="Add a product: search by name, SKU or barcode"
        aria-label="Add a product"
        disabled={add.isPending}
        autoComplete="off"
      />
      {results && (
        <ul className="grid max-h-60 gap-1 overflow-y-auto rounded-md border p-1" aria-label="Products to add">
          {results.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">No matches</li>}
          {results.map((product) => {
            const isListed = listed.has(product.id)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={isListed || add.isPending}
                  onClick={() =>
                    add.run(
                      () => addPairingAction({ owner, productId: product.id }),
                      () => setSearch("")
                    )
                  }
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{product.name}</span>
                    <span className="text-xs text-muted-foreground">{product.status === Status.PUBLISHED ? product.brandName : `${product.brandName} · ${product.status.toLowerCase()}`}</span>
                  </span>
                  {isListed ? <span className="text-xs text-muted-foreground">On the list</span> : <Plus className="size-4 shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function PairingsCard({ owner, pairings }: { owner: PairingOwner; pairings: PairingsData }) {
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()
  // hasSystemPermission, not checkRolePermission: roles can be comma-separated. The actions check again.
  const canEdit = hasSystemPermission(session?.user.role, owner.kind === "category" ? { category: ["update"] } : { product: ["update"] })
  const { items, inherited } = pairings

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Pairs well with
          <InfoTip about="Pairs well with">
            Shown on the product page, those on sale only, in this order.{" "}
            {owner.kind === "category"
              ? "Categories under this one use this list unless they have their own, and a product with its own list uses that instead."
              : "A product without its own list uses the nearest category's above it."}
          </InfoTip>
        </CardTitle>
        <CardDescription>{owner.kind === "category" ? "Products to suggest with this category's products." : "Products to suggest with this one."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {items.length > 0 ? (
          <ul className="grid divide-y">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <ItemLine item={item} />
                {isSessionLoading ? <Skeleton className="h-8 w-24" /> : canEdit && <ItemActions owner={owner} item={item} isFirst={index === 0} isLast={index === items.length - 1} />}
              </li>
            ))}
          </ul>
        ) : inherited ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Uses the list from {inherited.categoryName}. Adding a product gives this one its own instead.</p>
            <ul className="grid divide-y opacity-80">
              {inherited.items.map((item) => (
                <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                  <ItemLine item={item} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState icon={Puzzle} title="Nothing paired yet" description="Add what customers often need with these, like a recorder for cameras." />
        )}

        {isSessionLoading ? (
          <Skeleton className="h-9 w-full rounded-md" />
        ) : !canEdit ? (
          <p className="text-xs text-muted-foreground">Your role cannot change this list.</p>
        ) : items.length >= MAX_PAIRINGS ? (
          <p className="text-xs text-muted-foreground">A list holds at most {MAX_PAIRINGS} products. Remove one to add another.</p>
        ) : (
          <AddProduct owner={owner} listed={new Set(items.map((item) => item.productId))} />
        )}
      </CardContent>
    </Card>
  )
}
