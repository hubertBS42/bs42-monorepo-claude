import { Skeleton } from "@workspace/ui/components/skeleton"

// What a page looks like while it loads: each page's loading.tsx picks the skeleton of its shape, shown the moment a
// link to it is clicked. They copy the real pages' grids, card frames and spacing, so nothing jumps when the page
// arrives. Every page has its own loading.tsx (none above the whole console): Next shows a loading state only when
// its own part of the URL changes, and fetches it ahead of time only down to the first one on the way.

// A card's frame, as shadcn's Card draws it
function CardFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-6 rounded-xl bg-card py-6 shadow-xs ring-1 ring-foreground/10 ${className ?? ""}`}>{children}</div>
}

// A card with its title and description, then form fields (label over input), or lines of text
function CardSkeleton({ fields = 0, lines = 0, className }: { fields?: number; lines?: number; className?: string }) {
  return (
    <CardFrame className={className}>
      <div className="grid gap-2 px-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {(fields > 0 || lines > 0) && (
        <div className="grid gap-5 px-6">
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          {Array.from({ length: lines }, (_, line) => (
            <Skeleton key={line} className={`h-4 ${line % 3 === 2 ? "w-2/3" : "w-full"}`} />
          ))}
        </div>
      )}
    </CardFrame>
  )
}

// The page's title and its line, with buttons on the right (Back and Save, an add button)
function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-48 md:h-8" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, action) => (
            <Skeleton key={action} className="h-8 w-20" />
          ))}
        </div>
      )}
    </div>
  )
}

// data-skeleton names the shape, for checking which one a page shows
function Page({ kind, children }: { kind: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-y-6" role="status" aria-label="Loading" data-skeleton={kind}>
      {children}
    </div>
  )
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-t px-4 py-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

// A list: the title (and its add button), the filters toolbar and the table
export function ListPageSkeleton({ addButton = false }: { addButton?: boolean }) {
  return (
    <Page kind="list">
      <PageHeaderSkeleton actions={addButton ? 1 : 0} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <TableSkeleton />
    </Page>
  )
}

// A form or a record's page in two columns: the main cards, and narrower ones beside them (lg:grid-cols-3)
export function TwoColumnPageSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <Page kind="two-column">
      <PageHeaderSkeleton actions={actions} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <CardSkeleton fields={3} />
          <CardSkeleton fields={2} />
        </div>
        <div className="grid content-start gap-4">
          <CardSkeleton fields={1} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </Page>
  )
}

// A form in one column of full-width cards
export function SingleColumnPageSkeleton() {
  return (
    <Page kind="single-column">
      <PageHeaderSkeleton actions={2} />
      <CardSkeleton fields={4} />
      <CardSkeleton fields={2} />
    </Page>
  )
}

// A create wizard (orders, quotes): the steps, the step's two cards side by side, and Cancel / Next
export function WizardPageSkeleton() {
  return (
    <Page kind="wizard">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, step) => (
          <Skeleton key={step} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton fields={3} />
        <CardSkeleton fields={3} />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Page>
  )
}

// A page of link cards (the catalogue, a store's details)
export function HubPageSkeleton({ summary = false }: { summary?: boolean }) {
  return (
    <Page kind="hub">
      <PageHeaderSkeleton />
      {summary && <CardSkeleton lines={2} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <CardFrame key={card} className="gap-3 px-6">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40 max-w-full" />
          </CardFrame>
        ))}
      </div>
    </Page>
  )
}

// Choosing a product to list: the search, then a grid of product cards
export function PickerPageSkeleton() {
  return (
    <Page kind="picker">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, card) => (
          <div key={card} className="flex flex-col gap-2 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Skeleton className="aspect-square rounded-none" />
            <div className="grid gap-2 p-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}

// A section inside Settings or Account, whose layout keeps its own title and menu while the section loads
export function SectionSkeleton({ heading = false }: { heading?: boolean }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading" data-skeleton="section">
      {heading && (
        <div className="grid gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      )}
      <CardSkeleton fields={2} />
      <CardSkeleton fields={2} />
    </div>
  )
}

// The dashboard: the stat cards, the sales chart beside Needs attention, best sellers beside a second card, then the
// latest orders beside the order card (the same container-query grids as the real one)
export function DashboardSkeleton() {
  return (
    <Page kind="dashboard">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 4 }, (_, card) => (
            <CardFrame key={card} className="gap-3 px-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardFrame>
          ))}
        </div>
        <div className="grid gap-4 md:gap-6 @5xl/main:grid-cols-[2fr_1fr]">
          <CardFrame>
            <div className="flex items-start justify-between gap-4 px-6">
              <div className="grid gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-9 w-56" />
            </div>
            <div className="px-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </CardFrame>
          <CardSkeleton lines={4} />
        </div>
        <div className="grid gap-4 md:gap-6 @5xl/main:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
        <div className="grid items-start gap-4 md:gap-6 @5xl/main:grid-cols-[3fr_2fr]">
          <TableSkeleton rows={6} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    </Page>
  )
}
