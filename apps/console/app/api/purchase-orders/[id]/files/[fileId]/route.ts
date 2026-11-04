import { NextResponse } from "next/server"
import { prisma } from "@workspace/db"
import { readPrivateFile } from "@workspace/storage"
import { hasStorePermission } from "@/lib/auth-guard"
import { contentDisposition, getFileSession, isUuid } from "@/lib/purchase-order-files"
import { purchaseOrderFileUploadPolicy } from "@/lib/storage-api"

// Opens a purchase order's file for a member of its store (platform admins are members of every store). ?download=1
// saves it instead of showing it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await getFileSession(request)
  if (!session) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })

  const { id, fileId } = await params
  const notFound = NextResponse.json({ error: "File not found." }, { status: 404 })
  if (!isUuid(id) || !isUuid(fileId)) return notFound

  const file = await prisma.purchaseOrderFile.findFirst({
    where: { id: fileId, purchaseOrderId: id },
    select: { blobName: true, name: true, contentType: true, purchaseOrder: { select: { organizationId: true } } },
  })
  // Someone outside the store learns nothing about the file
  if (!file || !(await hasStorePermission(session.user.id, file.purchaseOrder.organizationId, { purchaseOrder: ["read"] }))) return notFound

  try {
    const { body, contentLength } = await readPrivateFile(file.blobName)
    // Only the types uploads accept are served as themselves
    const contentType = purchaseOrderFileUploadPolicy.acceptedTypes.includes(file.contentType) ? file.contentType : "application/octet-stream"
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        ...(contentLength !== undefined && { "Content-Length": String(contentLength) }),
        "Content-Disposition": contentDisposition(file.name, new URL(request.url).searchParams.has("download")),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Could not read a purchase order file:", error)
    return NextResponse.json({ error: "The file couldn't be opened." }, { status: 502 })
  }
}
