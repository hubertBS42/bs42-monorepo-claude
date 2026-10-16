import { Prisma, PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import slugify from "slugify"
import { deleteFiles, isManagedFileUrl } from "@workspace/storage"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"

type ModelType = "organization" | "brand" | "category"
type SlugClient = PrismaClient | Prisma.TransactionClient

const MAX_SLUG_RETRIES = 4

/* -------------------------------------------------------------------------- */
/*  Files                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Runs after the database change has committed. A failed blob delete leaves an
 * orphaned file, which is far cheaper than failing a request whose row is
 * already gone, so errors are logged instead of thrown.
 */
async function removeFiles(urls: (string | null | undefined)[]) {
  try {
    const files = urls.filter((url): url is string => !!url && isManagedFileUrl(url))
    if (files.length > 0) await deleteFiles(files)
  } catch (error) {
    console.error("File cleanup failed:", error)
  }
}

/* -------------------------------------------------------------------------- */
/*  Slugs                                                                      */
/* -------------------------------------------------------------------------- */

// `prefix` is tried before numbering a taken slug, e.g. a category's parent slug gives "men-accessories" rather than "accessories-1"
const generateUniqueSlug = async ({ name, id, model, client, prefix }: { name: string; id?: string; model: ModelType; client: SlugClient; prefix?: string }): Promise<string> => {
  const baseSlug =
    slugify(name, {
      lower: true,
      strict: true,
    }) || model

  const modelMap: Record<
    ModelType,
    {
      getById: (id: string) => Promise<{ name: string; slug: string } | null>
      getBySlug: (slug: string) => Promise<{ id: string } | null>
    }
  > = {
    organization: {
      getById: (id) =>
        client.organization.findUnique({
          where: { id },
          select: { name: true, slug: true },
        }),
      getBySlug: (slug) =>
        client.organization.findUnique({
          where: { slug },
          select: { id: true },
        }),
    },
    brand: {
      getById: (id) =>
        client.brand.findUnique({
          where: { id },
          select: { name: true, slug: true },
        }),
      getBySlug: (slug) =>
        client.brand.findUnique({
          where: { slug },
          select: { id: true },
        }),
    },
    category: {
      getById: (id) =>
        client.category.findUnique({
          where: { id },
          select: { name: true, slug: true },
        }),
      getBySlug: (slug) =>
        client.category.findUnique({
          where: { slug },
          select: { id: true },
        }),
    },
    // product: {
    //   getById: (id) =>
    //     client.product.findUnique({
    //       where: { id },
    //       select: { name: true, slug: true },
    //     }),
    //   getBySlug: (slug) =>
    //     client.product.findUnique({
    //       where: { slug },
    //       select: { id: true },
    //     }),
    // },
  }

  const { getById, getBySlug } = modelMap[model]

  // If the name hasn't changed, keep the existing slug
  if (id) {
    const existingRecord = await getById(id)
    if (existingRecord && existingRecord.name.trim() === name.trim()) {
      return existingRecord.slug
    }
  }

  const prefixedSlug = prefix ? `${prefix}-${baseSlug}` : undefined
  for (const candidate of prefixedSlug ? [baseSlug, prefixedSlug] : [baseSlug]) {
    const existing = await getBySlug(candidate)
    if (!existing || existing.id === id) return candidate
  }

  // Every candidate is taken, so number the last one
  const numberedBase = prefixedSlug ?? baseSlug
  let slug = numberedBase
  let count = 1
  let existing = await getBySlug(slug)
  while (existing && existing.id !== id) {
    slug = `${numberedBase}-${count++}`
    existing = await getBySlug(slug)
  }

  return slug
}

type ParentInput = { parentId?: unknown; parent?: unknown }

/**
 * The parent a category create or update sets, however the caller wrote it:
 * `parentId` (plain or `{ set }`) or `parent: { connect }` / `{ disconnect }`.
 * Returns null when the category becomes top-level, and undefined when the
 * data doesn't touch the parent.
 */
function getParentWhere(data: ParentInput): Prisma.CategoryWhereUniqueInput | null | undefined {
  if (data.parentId !== undefined) {
    const parentId = typeof data.parentId === "object" && data.parentId !== null ? (data.parentId as { set?: string | null }).set : data.parentId
    return typeof parentId === "string" ? { id: parentId } : parentId === null ? null : undefined
  }

  if (typeof data.parent === "object" && data.parent !== null) {
    const parent = data.parent as { connect?: Prisma.CategoryWhereUniqueInput; disconnect?: unknown }
    if (parent.connect) return parent.connect
    if (parent.disconnect) return null
  }

  return undefined
}

async function getParentSlug(client: SlugClient, where: Prisma.CategoryWhereUniqueInput | null | undefined) {
  if (!where) return undefined
  const parent = await client.category.findUnique({ where, select: { slug: true } })
  return parent?.slug
}

/**
 * Matches on the whole error meta rather than `meta.target`, because with
 * driver adapters the constraint details can live under
 * `meta.driverAdapterError` instead.
 */
function isSlugUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false
  }

  return JSON.stringify(error.meta ?? {})
    .toLowerCase()
    .includes("slug")
}

async function withUniqueSlugRetry<T>({
  name,
  id,
  model,
  client,
  prefix,
  run,
}: {
  name: string
  id?: string
  model: ModelType
  client: SlugClient
  prefix?: string
  run: (slug: string) => Promise<T>
}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const slug = await generateUniqueSlug({ name, id, model, client, prefix })

    try {
      return await run(slug)
    } catch (error) {
      if (!isSlugUniqueConstraintError(error) || attempt >= MAX_SLUG_RETRIES) {
        throw error
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                     */
/* -------------------------------------------------------------------------- */

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set")
  }

  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  return base.$extends({
    query: {
      organization: {
        async create({ args, query }) {
          // Better Auth requires a slug on create, so clients send a placeholder
          // (a random UUID). It is always discarded. The only exception is the
          // platform organization created by the bootstrap action. If anyone
          // else sends that slug, the unique constraint rejects it.
          if (args.data.slug === PLATFORM_ORGANIZATION_SLUG) {
            return query(args)
          }

          return withUniqueSlugRetry({
            name: args.data.name,
            model: "organization",
            client: base,
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async update({ args, query }) {
          const nameUpdate = args.data.name
          const name = typeof nameUpdate === "string" ? nameUpdate : nameUpdate?.set

          // Clients can never set the slug on update
          delete args.data.slug

          if (name === undefined) {
            return query(args)
          }

          const existing = await base.organization.findUnique({
            where: args.where,
            select: { id: true, slug: true },
          })

          // The platform organization's slug is fixed, whatever its name becomes
          if (!existing || existing.slug === PLATFORM_ORGANIZATION_SLUG) {
            return query(args)
          }

          return withUniqueSlugRetry({
            name,
            id: existing.id,
            model: "organization",
            client: base,
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async delete({ args, query }) {
          // Read the logo first so `select`/`include` on the caller's args still apply
          const existing = await base.organization.findUnique({
            where: args.where,
            select: { logo: true },
          })

          const deleted = await query(args)
          await removeFiles([existing?.logo])
          return deleted
        },

        async deleteMany({ args }) {
          const { result, logos } = await base.$transaction(async (tx) => {
            const organizations = await tx.organization.findMany({
              where: args.where,
              select: { id: true, logo: true },
            })

            const result = await tx.organization.deleteMany({
              where: { id: { in: organizations.map((organization) => organization.id) } },
            })

            return { result, logos: organizations.map((organization) => organization.logo) }
          })

          await removeFiles(logos)
          return result
        },
      },

      user: {
        async delete({ args, query }) {
          const existing = await base.user.findUnique({
            where: args.where,
            select: { image: true },
          })

          const deleted = await query(args)
          await removeFiles([existing?.image])
          return deleted
        },

        async deleteMany({ args }) {
          const { result, images } = await base.$transaction(async (tx) => {
            const users = await tx.user.findMany({
              where: args.where,
              select: { id: true, image: true },
            })

            const result = await tx.user.deleteMany({
              where: { id: { in: users.map((user) => user.id) } },
            })

            return { result, images: users.map((user) => user.image) }
          })

          // Files are removed only after the transaction has committed
          await removeFiles(images)
          return result
        },
      },

      brand: {
        async create({ args, query }) {
          return withUniqueSlugRetry({
            name: args.data.name,
            model: "brand",
            client: base,
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async update({ args, query }) {
          const nameUpdate = args.data.name
          const name = typeof nameUpdate === "string" ? nameUpdate : nameUpdate?.set

          // Clients can never set the slug on update
          delete args.data.slug

          if (name === undefined) {
            return query(args)
          }

          const existing = await base.brand.findUnique({
            where: args.where,
            select: { id: true, slug: true },
          })

          if (!existing) {
            return query(args)
          }

          return withUniqueSlugRetry({
            name,
            id: existing.id,
            model: "brand",
            client: base,
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async delete({ args, query }) {
          // Read the logo first so `select`/`include` on the caller's args still apply
          const existing = await base.brand.findUnique({
            where: args.where,
            select: { logo: true },
          })

          const deleted = await query(args)
          await removeFiles([existing?.logo])
          return deleted
        },

        async deleteMany({ args }) {
          const { result, logos } = await base.$transaction(async (tx) => {
            const brands = await tx.brand.findMany({
              where: args.where,
              select: { id: true, logo: true },
            })

            const result = await tx.brand.deleteMany({
              where: { id: { in: brands.map((brand) => brand.id) } },
            })

            return { result, logos: brands.map((brand) => brand.logo) }
          })

          await removeFiles(logos)
          return result
        },
      },
      category: {
        async create({ args, query }) {
          return withUniqueSlugRetry({
            name: args.data.name,
            model: "category",
            client: base,
            prefix: await getParentSlug(base, getParentWhere(args.data)),
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async update({ args, query }) {
          const nameUpdate = args.data.name
          const name = typeof nameUpdate === "string" ? nameUpdate : nameUpdate?.set

          // Clients can never set the slug on update
          delete args.data.slug

          if (name === undefined) {
            return query(args)
          }

          const existing = await base.category.findUnique({
            where: args.where,
            select: { id: true, slug: true, parentId: true },
          })

          if (!existing) {
            return query(args)
          }

          // Only a rename changes the slug, so moving a category keeps its URL. A rename that also
          // moves it takes the new parent's slug as the prefix.
          const newParent = getParentWhere(args.data)
          const parentWhere = newParent !== undefined ? newParent : existing.parentId ? { id: existing.parentId } : null

          return withUniqueSlugRetry({
            name,
            id: existing.id,
            model: "category",
            client: base,
            prefix: await getParentSlug(base, parentWhere),
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        async delete({ args, query }) {
          // Read the image first so `select`/`include` on the caller's args still apply
          const existing = await base.category.findUnique({
            where: args.where,
            select: { image: true },
          })

          const deleted = await query(args)
          await removeFiles([existing?.image])
          return deleted
        },

        async deleteMany({ args }) {
          const { result, images } = await base.$transaction(async (tx) => {
            const categories = await tx.category.findMany({
              where: args.where,
              select: { id: true, image: true },
            })

            const result = await tx.category.deleteMany({
              where: { id: { in: categories.map((category) => category.id) } },
            })

            return { result, images: categories.map((category) => category.image) }
          })

          await removeFiles(images)
          return result
        },
      },
    },
  })
}

type ExtendedPrisma = ReturnType<typeof createPrisma>

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma }

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
