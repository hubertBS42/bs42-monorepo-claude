import { Prisma, PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import slugify from "slugify"
// removeFiles runs after the delete has committed and never throws
import { removeFiles } from "@workspace/storage"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"

type ModelType = "organization" | "brand" | "category" | "product"
type SlugClient = PrismaClient | Prisma.TransactionClient

const MAX_SLUG_RETRIES = 4
const MAX_SKU_ATTEMPTS = 10

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
    product: {
      getById: (id) =>
        client.product.findUnique({
          where: { id },
          select: { name: true, slug: true },
        }),
      getBySlug: (slug) =>
        client.product.findUnique({
          where: { slug },
          select: { id: true },
        }),
    },
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
function isUniqueConstraintError(error: unknown, fields: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false
  }

  const meta = JSON.stringify(error.meta ?? {}).toLowerCase()
  return fields.some((field) => meta.includes(field))
}

async function withUniqueSlugRetry<T>({
  name,
  id,
  model,
  client,
  prefix,
  retryFields = ["slug"],
  run,
}: {
  name: string
  id?: string
  model: ModelType
  client: SlugClient
  prefix?: string
  // Unique columns whose conflict is worth another attempt; `run` must regenerate any besides the slug
  retryFields?: readonly string[]
  run: (slug: string) => Promise<T>
}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const slug = await generateUniqueSlug({ name, id, model, client, prefix })

    try {
      return await run(slug)
    } catch (error) {
      if (!isUniqueConstraintError(error, retryFields) || attempt >= MAX_SLUG_RETRIES) {
        throw error
      }
    }
  }
}

// Just the lookups it makes, so the base client and an extended transaction client both fit
type FindBySku = { findUnique(args: { where: { sku: string }; select: { id: true } }): PromiseLike<{ id: string } | null> }
type SkuClient = { product: FindBySku; productVariant: FindBySku }

/**
 * A SKU such as "IPHONE15-K3ZQ" that no product or variant uses yet. Inside a
 * transaction, pass its client so SKUs created earlier in it count as taken.
 */
export async function generateUniqueSku(client: SkuClient, name: string): Promise<string> {
  const prefix =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "PRODUCT"

  for (let attempt = 0; attempt < MAX_SKU_ATTEMPTS; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0")
    const sku = `${prefix}-${suffix}`

    // One after the other: a transaction has one connection, and pg is dropping support for overlapping queries on it
    if (await client.product.findUnique({ where: { sku }, select: { id: true } })) continue
    if (await client.productVariant.findUnique({ where: { sku }, select: { id: true } })) continue
    return sku
  }

  throw new Error("Could not generate a unique SKU")
}

const productFilesSelect = {
  images: true,
  banner: true,
  documents: { select: { url: true } },
  variants: { select: { images: true } },
} satisfies Prisma.ProductSelect

function getProductFiles(product: Prisma.ProductGetPayload<{ select: typeof productFilesSelect }>) {
  return [...product.images, product.banner, ...product.variants.flatMap((variant) => variant.images), ...product.documents.map((document) => document.url)]
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

      product: {
        async create({ args, query }) {
          // Simple products without a SKU get one; a product with variants has a SKU per variant instead
          const generateSku = !args.data.hasVariants && !args.data.sku

          return withUniqueSlugRetry({
            name: args.data.name,
            model: "product",
            client: base,
            // Only a generated SKU is retried; a conflict on one the caller chose is theirs to fix
            retryFields: generateSku ? ["slug", "sku"] : ["slug"],
            run: async (slug) => {
              args.data.slug = slug
              if (generateSku) args.data.sku = await generateUniqueSku(base, args.data.name)
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

          const existing = await base.product.findUnique({
            where: args.where,
            select: { id: true, slug: true },
          })

          if (!existing) {
            return query(args)
          }

          return withUniqueSlugRetry({
            name,
            id: existing.id,
            model: "product",
            client: base,
            run: (slug) => {
              args.data.slug = slug
              return query(args)
            },
          })
        },

        // Ordered products can't be deleted: OrderItem restricts both products and variants, so the
        // delete fails with P2003 and the caller should archive the product instead.
        async delete({ args, query }) {
          // Read the files first so `select`/`include` on the caller's args still apply
          const existing = await base.product.findUnique({
            where: args.where,
            select: productFilesSelect,
          })

          const deleted = await query(args)
          await removeFiles(existing ? getProductFiles(existing) : [])
          return deleted
        },

        async deleteMany({ args }) {
          const { result, files } = await base.$transaction(async (tx) => {
            const products = await tx.product.findMany({
              where: args.where,
              select: { id: true, ...productFilesSelect },
            })

            // Variants, documents and listings cascade with the product
            const result = await tx.product.deleteMany({
              where: { id: { in: products.map((product) => product.id) } },
            })

            return { result, files: products.flatMap(getProductFiles) }
          })

          await removeFiles(files)
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
