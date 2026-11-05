import Link from "next/link"
import { Newspaper } from "lucide-react"
import { formatDate } from "@workspace/utils/date"

import type { BlogPostCard as BlogPostCardData } from "@/lib/data/blog"

// A post on the blog's page and under a post: its image, date, title and summary, all one link
export function BlogPostCard({ post }: { post: BlogPostCardData }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className="aspect-3/2 overflow-hidden bg-muted">
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={post.image} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Newspaper className="size-10 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <time dateTime={post.publishedAt} className="text-xs text-muted-foreground">
          {formatDate(post.publishedAt, "d MMMM yyyy")}
        </time>
        <h2 className="text-lg leading-snug font-semibold normal-case group-hover:underline">{post.title}</h2>
        <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
      </div>
    </Link>
  )
}
