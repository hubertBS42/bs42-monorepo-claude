/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import z from "zod"
import { FileText } from "lucide-react"
import { Status } from "@workspace/db/enums"
import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import BackButton from "@/components/back-button"
import GlobalWorkspaceLink from "@/components/global-workspace-link"
import { Detail } from "@/components/orders/order-details"
import { CONDITION_LABELS } from "@/constants"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreProductDetails } from "@/lib/data/store-products.data"

export const metadata: Metadata = {
  title: "Product",
}

type StoreProductPageProps = {
  params: Promise<{ id: string }>
}

// A dash for a value the product doesn't have
const orDash = (value: string | null) => value ?? <span className="text-muted-foreground">—</span>

// A catalogue product, read-only, for a store's staff: the catalogue's own pages are for system admins
export default async function StoreProductPage({ params }: StoreProductPageProps) {
  const { storeId } = await requireActiveStoreMember()

  const { id } = await params
  // Product.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getStoreProductDetails(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const product = response.data
  const weight = (value: string | null) => orDash(value && `${value} kg`)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-bold md:text-2xl">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`${product.brandName} · ${product.categoryPath}`}</span>
            <Badge variant="outline">{CONDITION_LABELS[product.condition]}</Badge>
            {product.status !== Status.PUBLISHED && <Badge variant="secondary">{`${product.status === Status.DRAFT ? "Draft" : "Archived"} in the catalogue`}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BackButton link="/store/listings" />
          <GlobalWorkspaceLink href={`/catalogue/products/${product.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })} hideWithoutAccess>
            Edit in catalogue
          </GlobalWorkspaceLink>
          {product.listingId ? (
            <Link href={`/store/listings/${product.listingId}/edit`} className={buttonVariants({ size: "sm" })}>
              Edit listing
            </Link>
          ) : (
            product.status === Status.PUBLISHED && (
              <Link href={`/store/listings/add?productId=${product.id}`} className={buttonVariants({ size: "sm" })}>
                List in this store
              </Link>
            )
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>{product.description ? <RichTextContent value={product.description} /> : <p className="text-sm text-muted-foreground">No description yet.</p>}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Specifications</CardTitle>
              <CardDescription>What customers can compare and filter by.</CardDescription>
            </CardHeader>
            <CardContent>
              {product.specs.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {product.specs.map((spec) => (
                    <Detail key={spec.name} label={spec.name}>
                      {spec.value}
                    </Detail>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None set.</p>
              )}
            </CardContent>
          </Card>

          {product.hasVariants ? (
            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
                <CardDescription>Each with its own SKU, barcode and shipping details. Weights are in kg.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead>Variant</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Dimensions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.variants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                            No variants on sale.
                          </TableCell>
                        </TableRow>
                      ) : (
                        product.variants.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <div className="grid gap-0.5">
                                <span>{variant.label}</span>
                                {variant.status !== Status.PUBLISHED && <span className="text-[11px] text-muted-foreground">Draft in the catalogue</span>}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{variant.sku}</TableCell>
                            <TableCell className="font-mono text-xs">{orDash(variant.barcode)}</TableCell>
                            <TableCell>{orDash(variant.weight)}</TableCell>
                            <TableCell>{orDash(variant.dimensions)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Identification & Shipping</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Detail label="SKU">{orDash(product.sku)}</Detail>
                <Detail label="Barcode">{orDash(product.barcode)}</Detail>
                <Detail label="Weight">{weight(product.weight)}</Detail>
                <Detail label="Dimensions">{orDash(product.dimensions)}</Detail>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              {product.images.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {product.images.map((image) => (
                    <a key={image} href={image} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-md bg-muted">
                      <img alt="" src={image} loading="lazy" className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pictures yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catalogue Prices</CardTitle>
              <CardDescription>Suggested, in USD. Each store sets its own on its listing.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Detail label="Sell price">{formatCurrency(product.baseSellPrice)}</Detail>
              <Detail label="Buy price">{formatCurrency(product.baseBuyPrice)}</Detail>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
              <CardDescription>Done by the platform&apos;s installers, never a store.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{product.installationFeeGhs ? `${formatCurrency(product.installationFeeGhs, "GHS", "en-GH")} per item` : "Not offered"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {product.documents.length ? (
                <ul className="grid gap-2">
                  {product.documents.map((document) => (
                    <li key={document.id}>
                      <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline-offset-4 hover:underline">
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{document.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None attached.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
