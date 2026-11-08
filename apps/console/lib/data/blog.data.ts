import "server-only"

import type { BlogPostForEdit, BlogPostsData, BlogPostsParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { idsMatching, prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"

export const MAX_BLOG_POSTS_PAGE_SIZE = 100
export const BLOG_POST_SORT_FIELDS = ["title", "status", "publishedAt", "updatedAt"] as const

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

export const getBlogPosts = async (filters: BlogPostsParams = {}): Promise<DataResponse<BlogPostsData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_BLOG_POSTS_PAGE_SIZE, allowedSortFields: BLOG_POST_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { search, status, page = 1, pageSize = 10, sort, order } = filters
    const searchIds = search ? await idsMatching("blog_post", ["title", "excerpt"], search) : null
    const where: Prisma.BlogPostWhereInput = {
      ...(searchIds && { id: { in: searchIds } }),
      ...(status && { status }),
    }

    // Newest first by default, drafts (no date yet) at the top; id breaks ties so rows keep their order across pages
    const direction = order === "desc" ? "desc" : "asc"
    const orderBy: Prisma.BlogPostOrderByWithRelationInput[] = [
      sort === "publishedAt" ? { publishedAt: { sort: direction, nulls: "last" } } : sort ? { [sort]: direction } : { publishedAt: { sort: "desc", nulls: "first" } },
      { id: "asc" },
    ]

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, title: true, slug: true, image: true, status: true, publishedAt: true, updatedAt: true },
      }),
      prisma.blogPost.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: posts.map((post) => ({ ...post, publishedAt: post.publishedAt?.toISOString() ?? null, updatedAt: post.updatedAt.toISOString() })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getBlogPostById = async (id: string): Promise<DataResponse<BlogPostForEdit>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    // The id column is a uuid, so a malformed one would make Prisma throw
    if (!z.uuid().safeParse(id).success) return { success: false, error: "Post not found.", code: "NOT_FOUND" }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true, excerpt: true, body: true, image: true, status: true, publishedAt: true, updatedAt: true },
    })
    if (!post) return { success: false, error: "Post not found.", code: "NOT_FOUND" }

    return { success: true, data: { ...post, publishedAt: post.publishedAt?.toISOString() ?? null, updatedAt: post.updatedAt.toISOString() } }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
