import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"
import { Status } from "@workspace/db/enums"

// The blog's published posts. Cached like the rest of the storefront's data (60 s): the console can't clear another
// app's cache. Dates are ISO strings, as the cache keeps JSON.

export interface BlogPostCard {
  slug: string
  title: string
  excerpt: string
  image: string | null
  publishedAt: string
}

export interface BlogPost extends BlogPostCard {
  // Rich text (TipTap JSON), for RichTextContent
  body: string | null
  updatedAt: string
}

const cardSelect = { slug: true, title: true, excerpt: true, image: true, publishedAt: true } as const

// A published post always has its date (a CHECK in the migration)
const toCard = (post: { slug: string; title: string; excerpt: string; image: string | null; publishedAt: Date | null }): BlogPostCard => ({ ...post, publishedAt: post.publishedAt!.toISOString() })

// Newest first
export const getBlogPosts = unstable_cache(
  async (): Promise<BlogPostCard[]> => {
    const posts = await prisma.blogPost.findMany({ where: { status: Status.PUBLISHED }, orderBy: [{ publishedAt: "desc" }, { id: "asc" }], select: cardSelect })
    return posts.map(toCard)
  },
  ["store-blog-posts"],
  { revalidate: 60 }
)

// A published post by its slug, or null
export const getBlogPost = unstable_cache(
  async (slug: string): Promise<BlogPost | null> => {
    const post = await prisma.blogPost.findFirst({ where: { slug, status: Status.PUBLISHED }, select: { ...cardSelect, body: true, updatedAt: true } })
    return post && { ...toCard(post), body: post.body, updatedAt: post.updatedAt.toISOString() }
  },
  ["store-blog-post"],
  { revalidate: 60 }
)
