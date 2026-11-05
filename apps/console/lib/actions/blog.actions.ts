"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { sanitizeRichText } from "@workspace/utils/rich-text"
import { requireSystemPermission } from "@/lib/auth-guard"
import { blogPostFormSchema, updateBlogPostSchema } from "@/lib/schemas/blog.schemas"

// Every export here is a public endpoint, so every input is validated, and each one calls its guard before its try
// block (its redirect throws, which the catch would swallow)

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const NOT_FOUND: ActionResponse = { success: false, error: "This post no longer exists.", code: "NOT_FOUND" }
const INVALID_IMAGE: ActionResponse = { success: false, error: "Invalid image URL.", code: "INVALID_FILE" }
const CONFLICT: ActionResponse = {
  success: false,
  error: "Someone else changed this post while you were editing. Refresh the page to see their changes, then make yours again.",
  code: "CONFLICT",
}

// A post keeps the date it was first published, so unpublishing and publishing again doesn't move it to the top
function publishedAt(status: Status, current: Date | null) {
  return status === Status.PUBLISHED ? (current ?? new Date()) : current
}

export async function createBlogPostAction(input: z.input<typeof blogPostFormSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ blogPost: ["create"] })

  try {
    const parsed = blogPostFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { body, ...data } = parsed.data

    // The client could send any URL, so only accept blobs in our own container
    if (data.image !== null && !isManagedFileUrl(data.image)) return INVALID_IMAGE

    // Placeholder: the Prisma hook generates the real slug from the title
    await prisma.blogPost.create({ data: { ...data, slug: "", body: sanitizeRichText(body), publishedAt: publishedAt(data.status, null) } })
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function updateBlogPostAction(input: z.input<typeof updateBlogPostSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ blogPost: ["update"] })

  try {
    const parsed = updateBlogPostSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, updatedAt, body, ...data } = parsed.data

    if (data.image !== null && !isManagedFileUrl(data.image)) return INVALID_IMAGE

    const previous = await prisma.blogPost.findUnique({ where: { id }, select: { image: true, publishedAt: true, updatedAt: true } })
    if (!previous) return NOT_FOUND
    if (previous.updatedAt.toISOString() !== updatedAt) return CONFLICT

    // updatedAt in the where too, so a save that lands between the check and this one is refused (P2025) rather than
    // overwritten. update, not updateMany: the Prisma hook that renames the slug only runs on update.
    await prisma.blogPost.update({
      where: { id, updatedAt: previous.updatedAt },
      data: { ...data, body: sanitizeRichText(body), publishedAt: publishedAt(data.status, previous.publishedAt) },
    })

    // Only the server knows the previous image, so it removes a replaced one once the update has been saved
    if (previous.image !== data.image) await removeFiles([previous.image])
    return { success: true }
  } catch (error) {
    // Changed or deleted since the check
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return CONFLICT
    return { success: false, error: formatError(error) }
  }
}

export async function deleteBlogPostAction(postId: string): Promise<ActionResponse> {
  await requireSystemPermission({ blogPost: ["delete"] })

  try {
    const parsed = z.uuid("Invalid post ID").safeParse(postId)
    if (!parsed.success) return invalidInput(parsed.error)

    // The Prisma hook removes the image after the delete commits
    await prisma.blogPost.delete({ where: { id: parsed.data } })
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NOT_FOUND
    return { success: false, error: formatError(error) }
  }
}
