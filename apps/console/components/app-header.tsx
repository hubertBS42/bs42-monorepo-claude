"use client"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { BREADCRUMB_DATA } from "@/constants"
import { usePathname } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Fragment } from "react/jsx-runtime"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import ThemeToggle from "@workspace/ui/components/theme-toggle"

export function AppHeader() {
  const pathname = usePathname()

  // Find matching breadcrumb configuration
  const findBreadcrumbConfig = () => {
    // First, try exact match
    let breadcrumbConfig = BREADCRUMB_DATA.find((item) => item.pathname === pathname)

    // If no exact match, try pattern matching for dynamic routes
    if (!breadcrumbConfig) {
      breadcrumbConfig = BREADCRUMB_DATA.find((item) => {
        // Convert dynamic route pattern to regex
        const pathPattern = item.pathname.replace(/\[.*?\]/g, "[^/]+")
        const regex = new RegExp(`^${pathPattern}$`)
        return regex.test(pathname)
      })
    }

    return breadcrumbConfig
  }

  const breadcrumbConfig = findBreadcrumbConfig()
  const segments = breadcrumbConfig?.segments || [{ text: "Dashboard", href: "/" }]
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
                    {index !== segments.length - 1 ? (
                      <BreadcrumbLink render={<Link href={segment.href}>{segment.text}</Link>} />
                    ) : (
                      <BreadcrumbPage>{segment.text}</BreadcrumbPage>
                    )}
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
