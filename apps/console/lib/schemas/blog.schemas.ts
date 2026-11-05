import { Status } from "@workspace/db/enums"
import { z } from "zod"
import { optionalHttpUrl } from "./common.schemas"

export const BLOG_TITLE_MAX = 150
export const BLOG_EXCERPT_MAX = 500

export const blogPostFormSchema = z.object({
  title: z.string().trim().min(1, "Give the post a title.").max(BLOG_TITLE_MAX, `At most ${BLOG_TITLE_MAX} characters.`),
  excerpt: z.string().trim().min(1, "Write a short summary.").max(BLOG_EXCERPT_MAX, `At most ${BLOG_EXCERPT_MAX} characters.`),
  // TipTap JSON from RichTextField, null when empty; the action saves it through sanitizeRichText
  body: z.string().max(200_000, "The post is too long.").nullable(),
  image: optionalHttpUrl("Invalid image URL."),
  status: z.enum(Status),
})

export const updateBlogPostSchema = blogPostFormSchema.extend({
  id: z.uuid("Invalid post ID."),
  // When the page loaded the post, so a save can't overwrite someone else's
  updatedAt: z.iso.datetime(),
})
