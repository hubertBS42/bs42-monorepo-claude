import { Skeleton } from "@workspace/ui/components/skeleton"

// What a customer's own page looks like while it loads, in the real page's width, padding and grid, so nothing jumps
// when it arrives. Only private pages have one (account, basket, checkout, an order, an invoice or quotation,
// compare): on product, category and brand pages a loading state would cost their 404s and redirects (see
// app/search/loading.tsx). data-skeleton names the shape, for checking which one a page shows.

function Lines({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, line) => (
        <Skeleton key={line} className={`h-4 ${line % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  )
}

// A bordered box with a heading, then form fields (label over input) or lines of text
function Box({ fields = 0, lines = 0 }: { fields?: number; lines?: number }) {
  return (
    <div className="space-y-5 rounded-xl border p-5">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: fields }, (_, field) => (
        <div key={field} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {lines > 0 && <Lines count={lines} />}
    </div>
  )
}

// The order summary beside a basket or checkout
function SummaryBox() {
  return (
    <div className="space-y-4 rounded-xl border p-5">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="flex justify-between gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

// A product line: its picture, name and price
function LineRow() {
  return (
    <div className="flex items-center gap-4 py-4">
      <Skeleton className="size-16 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

// An account section, inside the account layout (which keeps its title and menu): a list of boxes
export function AccountSectionSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading" data-skeleton="account">
      {Array.from({ length: 3 }, (_, box) => (
        <div key={box} className="flex items-center gap-4 rounded-xl border p-5">
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export function BasketSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 lg:px-6" role="status" aria-label="Loading" data-skeleton="basket">
      <Skeleton className="h-8 w-48 md:h-9" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="divide-y">
          {Array.from({ length: 3 }, (_, line) => (
            <LineRow key={line} />
          ))}
        </div>
        <SummaryBox />
      </div>
    </div>
  )
}

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 lg:px-6" role="status" aria-label="Loading" data-skeleton="checkout">
      <div className="mb-6 flex items-baseline justify-between gap-2">
        <Skeleton className="h-8 w-40 md:h-9" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="space-y-6">
          <Box fields={3} />
          <Box fields={4} />
        </div>
        <SummaryBox />
      </div>
    </div>
  )
}

// An order's page: what happened to it, its lines beside its progress and delivery
export function OrderPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 lg:px-6" role="status" aria-label="Loading" data-skeleton="order">
      <div className="mb-8 space-y-4">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-8 w-80 max-w-full md:h-9" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <div className="rounded-xl border p-5">
          <Skeleton className="h-5 w-48" />
          <LineRow />
          <div className="ml-auto max-w-xs space-y-2 border-t pt-4">
            <Lines count={3} />
          </div>
        </div>
        <div className="space-y-6">
          <Box lines={4} />
          <Box lines={3} />
        </div>
      </div>
    </div>
  )
}

// A printable invoice or quotation: the bar above it, then the document (header, addresses, lines and totals)
export function DocumentSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 lg:px-6" role="status" aria-label="Loading" data-skeleton="document">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-8 rounded-xl border p-8">
        <div className="flex items-start justify-between gap-6">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            <Skeleton className="ml-auto h-5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Lines count={3} />
          <Lines count={3} />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, row) => (
            <Skeleton key={row} className="h-4 w-full" />
          ))}
        </div>
        <div className="ml-auto max-w-xs space-y-2">
          <Lines count={3} />
        </div>
      </div>
    </div>
  )
}

// Comparing products: the title, then a column per product beside the row labels
export function CompareSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-6" role="status" aria-label="Loading" data-skeleton="compare">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-72 max-w-full md:h-9" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="grid grid-cols-[8rem_repeat(3,minmax(0,1fr))] gap-4">
        <div />
        {Array.from({ length: 3 }, (_, product) => (
          <div key={product} className="space-y-2">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="col-span-4 grid grid-cols-subgrid border-t pt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
