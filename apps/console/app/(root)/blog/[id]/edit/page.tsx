import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { authURLs } from "@workspace/auth/constants"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getBlogPostById } from "@/lib/data/blog.data"
import BlogPostForm from "../../_components/blog-post-form"

export const metadata: Metadata = {
  title: "Edit Post",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: Props) {
  await requireSystemPermission({ blogPost: ["update"] })

  const { id } = await params
  // getBlogPostById returns NOT_FOUND for an id that isn't a UUID
  const response = await getBlogPostById(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <BlogPostForm post={response.data} postUrl={new URL(`/blog/${response.data.slug}`, authURLs.store).toString()} />
}
