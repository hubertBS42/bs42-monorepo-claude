"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { type SubmitHandler, useForm } from "react-hook-form"
import type { z } from "zod"
import { ExternalLink } from "lucide-react"
import { Status } from "@workspace/db/enums"
import { ImageField, RichTextField, SelectField, TextareaField, TextInputField } from "@workspace/forms"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { DangerZoneCard } from "@/components/danger-zone-card"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { STATUS_OPTIONS } from "@/constants"
import { createBlogPostAction, updateBlogPostAction } from "@/lib/actions/blog.actions"
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX, blogPostFormSchema } from "@/lib/schemas/blog.schemas"
import { deleteImages, uploadImages } from "@/lib/storage"
import type { BlogPostForEdit } from "@/types"
import DeleteBlogPost from "./delete-blog-post"

type FormInput = z.input<typeof blogPostFormSchema>
type FormOutput = z.output<typeof blogPostFormSchema>

// Adding a post, or editing one (`post`). `postUrl` is the post's storefront page, for "View on blog" once it's published.
export default function BlogPostForm({ post, postUrl }: { post?: BlogPostForEdit; postUrl?: string }) {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading, so a second click would
  // save again. This keeps the form locked from a successful save until the page changes.
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(blogPostFormSchema),
    defaultValues: {
      title: post?.title ?? "",
      excerpt: post?.excerpt ?? "",
      body: post?.body ?? null,
      image: post?.image ?? "",
      status: post?.status ?? Status.DRAFT,
    },
  })

  const onSubmit: SubmitHandler<FormOutput> = async (values) => {
    // The update action removes a replaced image itself once the post has been saved
    const response = post ? await updateBlogPostAction({ ...values, id: post.id, updatedAt: post.updatedAt }) : await createBlogPostAction(values)

    if (!response.success) {
      toast.add({ title: "Unable to save the post", description: response.error, type: "error" })
      if (response.code === "CONFLICT") router.refresh()
      return
    }

    setIsSaved(true)
    router.push("/blog")
    toast.add({
      title: post ? "Post updated" : "Post added",
      description: values.status === Status.PUBLISHED ? "The storefront shows it within a minute." : "It isn't on the storefront until it's published.",
      type: "success",
    })
  }

  const isBusy = form.formState.isSubmitting || isSaved

  const handleAddImage = async (files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  // The saved image is removed by the server on save, so discarding needs no restore
  const handleRemoveImage = async (url: string) => {
    if (url === post?.image) return
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("image")
    try {
      if (image?.trim() && image !== post?.image) await deleteImages([image])
      router.push("/blog")
    } catch (error) {
      toast.add({
        title: "Unable to discard changes",
        description: error instanceof Error ? error.message : "The uploaded image could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading={post ? "Edit Post" : "Add Post"}
          description={post ? "Changes show on the storefront within a minute." : "A post for the storefront's blog."}
          backTo="/blog"
          isPending={isBusy}
          isDirty={form.formState.isDirty}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="grid gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Post</CardTitle>
                  <CardDescription>The title, summary and text, as readers see them.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField
                      control={form.control}
                      label="Title"
                      name="title"
                      disabled={isBusy}
                      maxLength={BLOG_TITLE_MAX}
                      showCount
                      info="Its web address comes from the title, so renaming a published post changes its link."
                    />
                    <TextareaField
                      control={form.control}
                      label="Summary"
                      name="excerpt"
                      disabled={isBusy}
                      maxLength={BLOG_EXCERPT_MAX}
                      showCount
                      info="Shown on the post's card and in search results."
                    />
                    <RichTextField control={form.control} label="Text" name="body" placeholder="Write the post..." disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>
                    {post?.publishedAt ? `Dated ${formatDate(post.publishedAt, "MMM d, yyyy")}, when it was first published.` : "Only published posts are on the storefront."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SelectField control={form.control} name="status" disabled={isBusy} options={STATUS_OPTIONS} aria-label="Status" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Image</CardTitle>
                  <CardDescription>Shown on the post&apos;s card and at the top of the post.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageField
                    control={form.control}
                    name="image"
                    sizeLimit={500}
                    maxImages={1}
                    onAdd={handleAddImage}
                    onRemove={handleRemoveImage}
                    clearErrors={form.clearErrors}
                    label="Image"
                    description="A wide photo, about 1600 × 900."
                    disabled={isBusy}
                    className="max-w-35"
                    defaultValues={post?.image ?? null}
                  />
                </CardContent>
              </Card>

              {post?.status === Status.PUBLISHED && postUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle>Storefront</CardTitle>
                    <CardDescription>Readers see it on the blog.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a href={postUrl} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                      View on blog
                      <ExternalLink data-icon="inline-end" aria-hidden />
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {post && (
            <DangerZoneCard description="Permanently delete this post.">
              <DeleteBlogPost post={post} />
            </DangerZoneCard>
          )}

          <SharedFormFooter backTo="/blog" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
