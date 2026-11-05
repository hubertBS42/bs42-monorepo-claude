import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { formatDate } from "@workspace/utils/date"

import { BlogPostCard } from "@/components/blog/blog-card"
import { getBlogPost, getBlogPosts } from "@/lib/data/blog"
import { getStoreName } from "@/lib/settings"
import { blogPostingJsonLd, breadcrumbJsonLd, JsonLd } from "@/lib/structured-data"

// How many other posts to suggest under a post
const MORE_POSTS = 3

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPost((await params).slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt, ...(post.image && { images: [post.image] }) },
  }
}

// No loading.tsx here, as on product pages: it would stream the page before notFound() could answer 404
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (!post) notFound()
  const [posts, storeName] = await Promise.all([getBlogPosts(), getStoreName()])
  const more = posts.filter((other) => other.slug !== post.slug).slice(0, MORE_POSTS)

  return (
    <div className="pb-16">
      <JsonLd
        data={[
          blogPostingJsonLd(post, storeName),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 pt-6 lg:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/blog" />}>Blog</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1">{post.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight normal-case md:text-4xl">{post.title}</h1>
          <time dateTime={post.publishedAt} className="mt-3 block text-sm text-muted-foreground">
            {formatDate(post.publishedAt, "d MMMM yyyy")}
          </time>
        </header>

        {post.image && (
          // The whole picture, never cropped: some are square
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={post.image} alt="" className="mt-6 max-h-128 w-full rounded-xl bg-muted object-contain" />
        )}

        {post.body ? <RichTextContent value={post.body} className="mt-8" /> : <p className="mt-8 text-muted-foreground">{post.excerpt}</p>}

        <Button render={<Link href="/blog" />} variant="outline" size="sm" className="mt-10">
          <ArrowLeft />
          All posts
        </Button>
      </article>

      {more.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4 lg:px-6" aria-labelledby="more-posts">
          <h2 id="more-posts" className="mb-6 text-2xl font-bold tracking-tight">
            More from the blog
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((other) => (
              <BlogPostCard key={other.slug} post={other} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
