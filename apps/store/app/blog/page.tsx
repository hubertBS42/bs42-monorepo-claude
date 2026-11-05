import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

import { BlogPostCard } from "@/components/blog/blog-card"
import { getBlogPosts } from "@/lib/data/blog"

const POSTS_PER_PAGE = 12

interface BlogPageProps {
  searchParams: Promise<{ page?: string | string[] }>
}

// A page number from the URL, within the pages there are
function pageNumber(value: string | string[] | undefined, pageCount: number) {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) && page > 1 ? Math.min(page, pageCount) : 1
}

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const page = pageNumber((await searchParams).page, Number.MAX_SAFE_INTEGER)
  return {
    title: "Blog",
    description: "Guides and news on security systems, smart homes, networking and solar.",
    alternates: { canonical: page > 1 ? `/blog?page=${page}` : "/blog" },
  }
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const posts = await getBlogPosts()
  const pageCount = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE))
  const page = pageNumber((await searchParams).page, pageCount)
  const shown = posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Blog</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Blog</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Guides and news on security systems, smart homes, networking and solar.</p>
      </header>

      {shown.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Newspaper} title="No posts yet" description="Guides and news will show here." className="rounded-xl border">
          <Button render={<Link href="/" />} variant="outline" size="sm">
            Continue shopping
          </Button>
        </EmptyState>
      )}

      {pageCount > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pages">
          {page > 1 && (
            <Button render={<Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} />} variant="outline" size="sm">
              <ChevronLeft />
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Button render={<Link href={`/blog?page=${page + 1}`} />} variant="outline" size="sm">
              Next
              <ChevronRight />
            </Button>
          )}
        </nav>
      )}
    </div>
  )
}
