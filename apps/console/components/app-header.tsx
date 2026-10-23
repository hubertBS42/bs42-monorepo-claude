"use client"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { BREADCRUMB_DATA } from "@/constants"
import { navConfig } from "@/lib/nav-config"
import type { BreadcrumbSegment } from "@/types"
import { usePathname } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Fragment } from "react/jsx-runtime"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import ThemeToggle from "@workspace/ui/components/theme-toggle"

export function AppHeader() {
  const pathname = usePathname()

  const segments = findBreadcrumbs(pathname)
  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              return (
                <Fragment key={index}>
                  <BreadcrumbItem
                    className={cn({
                      "hidden md:block": index !== segments.length - 1,
                    })}
                  >
                    {index !== segments.length - 1 ? <BreadcrumbLink render={<Link href={segment.href}>{segment.text}</Link>} /> : <BreadcrumbPage>{segment.text}</BreadcrumbPage>}
                  </BreadcrumbItem>
                  {index !== segments.length - 1 && (
                    <BreadcrumbSeparator
                      className={cn({
                        "hidden md:block": index !== segments.length - 1,
                      })}
                    />
                  )}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <ThemeToggle className="ml-auto" />
      </div>
    </header>
  )
}

const DASHBOARD: BreadcrumbSegment = { text: "Dashboard", href: "/" }

// The page's trail from BREADCRUMB_DATA: an exact match first (so /store/orders/create isn't taken for an [id]), then
// a dynamic one, whose links get the URL's own [id]. A page with no entry shows its sidebar section instead.
function findBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const exact = BREADCRUMB_DATA.find((item) => item.pathname === pathname)
  if (exact) return exact.segments

  for (const item of BREADCRUMB_DATA) {
    const match = pathname.match(new RegExp(`^${item.pathname.replace(/\[[^\]]+\]/g, "([^/]+)")}$`))
    if (!match) continue
    const names = item.pathname.match(/\[[^\]]+\]/g) ?? []
    const fill = (href: string) => names.reduce((result, name, index) => result.replace(name, match[index + 1]!), href)
    return item.segments.map((segment) => ({ ...segment, href: fill(segment.href) }))
  }

  return sectionBreadcrumbs(pathname)
}

// The sidebar entry whose url is the longest prefix of the pathname, under its group's title for a sub-item
function sectionBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const within = (url: string) => url !== "/" && (pathname === url || pathname.startsWith(`${url}/`))
  let best: { url: string; trail: BreadcrumbSegment[] } | null = null
  for (const entry of navConfig) {
    const candidates = [
      { url: entry.url, trail: [{ text: entry.title, href: entry.url }] },
      ...(entry.items ?? []).map((item) => ({
        url: item.url,
        trail: [
          { text: entry.title, href: entry.url },
          { text: item.title, href: item.url },
        ],
      })),
    ]
    for (const candidate of candidates) {
      if (within(candidate.url) && (!best || candidate.url.length > best.url.length)) best = candidate
    }
  }
  return [DASHBOARD, ...(best?.trail ?? [])]
}
