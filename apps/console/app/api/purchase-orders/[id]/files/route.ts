import { NextResponse } from "next/server"
import { prisma } from "@workspace/db"
import { removePrivateFiles, StorageValidationError, uploadPrivateFiles } from "@workspace/storage"
import { hasStorePermission } from "@/lib/auth-guard"
import { MAX_FILES_PER_PURCHASE_ORDER } from "@/lib/purchase-order-file-rules"
import { cleanFileName, getFileSession, isUuid } from "@/lib/purchase-order-files"
import { errorResponse, purchaseOrderFileUploadPolicy, readUploadFiles } from "@/lib/storage-api"

// Adds files to a purchase order, optionally tied to one of its deliveries (?receipt=). Anyone in the store who can
// receive deliveries can add them: whoever unpacks the boxes has the delivery note.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getFileSession(request)
  if (!session) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })

  const { id } = await params
  const receiptId = new URL(request.url).searchParams.get("receipt")
  if (!isUuid(id) || (receiptId !== null && !isUuid(receiptId))) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 })

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { organizationId: true, _count: { select: { files: true } }, receipts: receiptId ? { where: { id: receiptId }, select: { id: true } } : false },
  })
  // Someone outside the store learns nothing about the order
  if (!order || !(await hasStorePermission(session.user.id, order.organizationId, { purchaseOrder: ["read"] }))) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 })
  }
  if (!(await hasStorePermission(session.user.id, order.organizationId, { purchaseOrder: ["receive"] }))) {
    return NextResponse.json({ error: "Your role in this store can't add files." }, { status: 403 })
  }
  if (receiptId && !order.receipts?.length) return NextResponse.json({ error: "That delivery isn't on this purchase order." }, { status: 400 })

  try {
    const files = await readUploadFiles(request, purchaseOrderFileUploadPolicy)
    if (order._count.files + files.length > MAX_FILES_PER_PURCHASE_ORDER) {
      throw new StorageValidationError(`A purchase order holds at most ${MAX_FILES_PER_PURCHASE_ORDER} files. Remove one to add another.`, 413)
    }

    const blobNames = await uploadPrivateFiles(files)
    try {
      await prisma.purchaseOrderFile.createMany({
        data: files.map((file, index) => ({
          purchaseOrderId: id,
          receiptId,
          blobName: blobNames[index]!,
          name: cleanFileName(file.name),
          contentType: file.type.toLowerCase(),
          size: file.size,
          uploadedById: session.user.id,
        })),
      })
    } catch (error) {
      // The order may have been deleted meanwhile: don't leave its files behind
      await removePrivateFiles(blobNames, "Purchase order upload cleanup")
      throw error
    }

    return NextResponse.json({ count: files.length })
  } catch (error) {
    return errorResponse(error)
  }
}
