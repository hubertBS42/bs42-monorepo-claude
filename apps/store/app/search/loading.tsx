import { Skeleton } from "@workspace/ui/components/skeleton"

// Shown the moment a search is submitted, in the results page's layout, while the results load. Product, category and
// brand pages have none on purpose: a loading state streams the response before the page could answer 404 or
// redirect, so those would reach search engines as 200s.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-6" role="status" aria-label="Loading">
      <Skeleton className="mb-6 h-9 w-72 max-w-full" />
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <div className="hidden space-y-6 lg:block">
          {Array.from({ length: 3 }, (_, group) => (
            <div key={group} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-8 w-36" />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, card) => (
              <li key={card} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-5 w-24" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
