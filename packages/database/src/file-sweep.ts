import { deleteFiles, listFiles } from "@workspace/storage"
import { prisma } from "./client"

// Forms upload an image as soon as it's picked, before the record is saved, so a new blob is unreferenced
// until the form is submitted. Only blobs older than this are considered orphaned.
const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

const DELETE_BATCH_SIZE = 100

/**
 * Every file URL the database still points at. Add new file columns here and in findReferencedFileUrls, or the
 * sweep deletes their files and the delete route stops protecting them.
 * Order items keep their product image as a snapshot of what was sold, so it counts too.
 */
async function getReferencedFileUrls(): Promise<Set<string>> {
  const [users, organizations, brands, categories, appSettings, products, variants, documents, orderItems] = await Promise.all([
    prisma.user.findMany({ where: { image: { not: null } }, select: { image: true } }),
    prisma.organization.findMany({ where: { logo: { not: null } }, select: { logo: true } }),
    prisma.brand.findMany({ where: { logo: { not: null } }, select: { logo: true } }),
    prisma.category.findMany({ where: { image: { not: null } }, select: { image: true } }),
    prisma.appSettings.findMany({ select: { logoUrl: true, faviconUrl: true } }),
    prisma.product.findMany({ select: { images: true, banner: true } }),
    prisma.productVariant.findMany({ select: { images: true } }),
    prisma.productDocument.findMany({ select: { url: true } }),
    prisma.orderItem.findMany({ where: { productImage: { not: null } }, select: { productImage: true } }),
  ])

  const urls = [
    ...users.map((user) => user.image),
    ...organizations.map((organization) => organization.logo),
    ...brands.map((brand) => brand.logo),
    ...categories.map((category) => category.image),
    ...appSettings.flatMap((settings) => [settings.logoUrl, settings.faviconUrl]),
    ...products.flatMap((product) => [...product.images, product.banner]),
    ...variants.flatMap((variant) => variant.images),
    ...documents.map((document) => document.url),
    ...orderItems.map((item) => item.productImage),
  ]

  return new Set(urls.filter((url): url is string => !!url))
}

/**
 * Which of these URLs a database row still points at. The same columns as getReferencedFileUrls, queried for just
 * these URLs, so it's cheap enough to run on every delete request. Keep the two lists in sync.
 */
export async function findReferencedFileUrls(urls: readonly string[]): Promise<string[]> {
  if (urls.length === 0) return []
  const list = [...urls]

  const [users, organizations, brands, categories, appSettings, products, variants, documents, orderItems] = await Promise.all([
    prisma.user.findMany({ where: { image: { in: list } }, select: { image: true } }),
    prisma.organization.findMany({ where: { logo: { in: list } }, select: { logo: true } }),
    prisma.brand.findMany({ where: { logo: { in: list } }, select: { logo: true } }),
    prisma.category.findMany({ where: { image: { in: list } }, select: { image: true } }),
    prisma.appSettings.findMany({ where: { OR: [{ logoUrl: { in: list } }, { faviconUrl: { in: list } }] }, select: { logoUrl: true, faviconUrl: true } }),
    prisma.product.findMany({ where: { OR: [{ images: { hasSome: list } }, { banner: { in: list } }] }, select: { images: true, banner: true } }),
    prisma.productVariant.findMany({ where: { images: { hasSome: list } }, select: { images: true } }),
    prisma.productDocument.findMany({ where: { url: { in: list } }, select: { url: true } }),
    prisma.orderItem.findMany({ where: { productImage: { in: list } }, select: { productImage: true } }),
  ])

  const found = new Set<string | null>([
    ...users.map((user) => user.image),
    ...organizations.map((organization) => organization.logo),
    ...brands.map((brand) => brand.logo),
    ...categories.map((category) => category.image),
    ...appSettings.flatMap((settings) => [settings.logoUrl, settings.faviconUrl]),
    ...products.flatMap((product) => [...product.images, product.banner]),
    ...variants.flatMap((variant) => variant.images),
    ...documents.map((document) => document.url),
    ...orderItems.map((item) => item.productImage),
  ])

  return list.filter((url) => found.has(url))
}

export interface FileSweepResult {
  scanned: number
  orphaned: string[]
  deleted: number
}

/**
 * Deletes blobs that no database row references, such as images uploaded on a form that was then left without
 * saving or discarding. With dryRun it only reports what it would delete.
 */
export async function sweepOrphanedFiles({ gracePeriodMs = DEFAULT_GRACE_PERIOD_MS, dryRun = false } = {}): Promise<FileSweepResult> {
  // Load the references first: if this fails, nothing is deleted
  const referenced = await getReferencedFileUrls()
  const cutoff = Date.now() - gracePeriodMs

  let scanned = 0
  const orphaned: string[] = []
  for await (const file of listFiles()) {
    scanned++
    if (file.lastModified.getTime() < cutoff && !referenced.has(file.url)) orphaned.push(file.url)
  }

  if (dryRun) return { scanned, orphaned, deleted: 0 }

  let deleted = 0
  for (let i = 0; i < orphaned.length; i += DELETE_BATCH_SIZE) {
    const batch = orphaned.slice(i, i + DELETE_BATCH_SIZE)
    await deleteFiles(batch)
    deleted += batch.length
  }

  return { scanned, orphaned, deleted }
}
