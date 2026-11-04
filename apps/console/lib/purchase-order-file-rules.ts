// Purchase order files' limits, shared by the upload route (lib/storage-api.ts's policy) and the browser, which checks
// them first so a wrong file is named before anything is sent

export const MAX_FILES_PER_PURCHASE_ORDER = 20
export const MAX_FILES_PER_UPLOAD = 10
export const MAX_PURCHASE_ORDER_FILE_BYTES = 10 * 1024 * 1024
export const PURCHASE_ORDER_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
// The file picker's filter
export const PURCHASE_ORDER_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp," + PURCHASE_ORDER_FILE_TYPES.join(",")

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Why a picked file can't be added, or null when it can
export function fileProblem(file: File): string | null {
  if (!PURCHASE_ORDER_FILE_TYPES.includes(file.type.toLowerCase())) return `${file.name} isn't a PDF or a JPEG, PNG or WebP image.`
  if (file.size > MAX_PURCHASE_ORDER_FILE_BYTES) return `${file.name} is over 10 MB.`
  if (file.size === 0) return `${file.name} is empty.`
  return null
}

// Sends files to a purchase order (and one of its deliveries); the route checks everything again
export async function uploadPurchaseOrderFiles(orderId: string, files: readonly File[], receiptId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData()
  for (const file of files) body.append("files", file)
  try {
    const response = await fetch(`/api/purchase-orders/${orderId}/files${receiptId ? `?receipt=${receiptId}` : ""}`, { method: "POST", body })
    if (response.ok) return { ok: true }
    const reply = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: reply?.error ?? "The files couldn't be uploaded." }
  } catch {
    return { ok: false, error: "The files couldn't be uploaded. Check your connection and try again." }
  }
}
