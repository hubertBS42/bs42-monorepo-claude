import type { Metadata } from "next"
import { requireSystemPermission } from "@/lib/auth-guard"
import BlogPostForm from "../_components/blog-post-form"

export const metadata: Metadata = {
  title: "Add Post",
}

export default async function AddBlogPostPage() {
  await requireSystemPermission({ blogPost: ["create"] })

  return <BlogPostForm />
}
