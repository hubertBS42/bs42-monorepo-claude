import { deleteFiles, restoreFiles, StorageValidationError, uploadFiles } from "@workspace/storage"
import { NextResponse } from "next/server"
import type { DocumentItem } from "@workspace/contracts"

interface UploadPolicy {
  maxFiles: number
  maxFileSizeBytes: number
  maxTotalSizeBytes: number
  acceptedTypes: readonly string[]
}

const MAX_URLS_PER_REQUEST = 100
const MAX_URL_REQUEST_BYTES = 128 * 1024
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024

export const imageUploadPolicy: UploadPolicy = {
  maxFiles: 3,
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxTotalSizeBytes: 20 * 1024 * 1024,
  acceptedTypes: ["image/*"],
}

export const documentUploadPolicy: UploadPolicy = {
  maxFiles: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxTotalSizeBytes: 50 * 1024 * 1024,
  acceptedTypes: ["application/pdf"],
}

function getRequestSize(request: Request): number | null {
  const header = request.headers.get("content-length")
  if (!header) return null

  const size = Number(header)
  return Number.isSafeInteger(size) && size >= 0 ? size : null
}

async function readUploadFiles(request: Request, policy: UploadPolicy): Promise<File[]> {
  const requestSize = getRequestSize(request)
  if (requestSize !== null && requestSize > policy.maxTotalSizeBytes + MULTIPART_OVERHEAD_BYTES) {
    throw new StorageValidationError("The upload request is too large.", 413)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new StorageValidationError("The request must contain multipart form data.")
  }

  const entries = formData.getAll("files")
  if (entries.some((entry) => typeof entry === "string")) {
    throw new StorageValidationError("The files field must contain uploaded files.")
  }

  const files = entries.filter((entry): entry is File => typeof entry !== "string")
  if (files.length === 0) {
    throw new StorageValidationError("Select at least one file.")
  }
  if (files.length > policy.maxFiles) {
    throw new StorageValidationError(`You can upload up to ${policy.maxFiles} files.`, 413)
  }

  let totalSize = 0
  for (const file of files) {
    const accepted = policy.acceptedTypes.some((type) =>
      type.endsWith("/*") ? file.type.toLowerCase().startsWith(type.slice(0, -1)) : file.type.toLowerCase() === type
    )
    if (!accepted) {
      throw new StorageValidationError(`${file.name} is not an accepted file type.`, 415)
    }
    if (file.size > policy.maxFileSizeBytes) {
      throw new StorageValidationError("A file exceeds the per-file size limit.", 413)
    }

    totalSize += file.size
    if (totalSize > policy.maxTotalSizeBytes) {
      throw new StorageValidationError("The total upload size limit was exceeded.", 413)
    }
  }

  return files
}

async function readUrls(request: Request): Promise<string[]> {
  const requestSize = getRequestSize(request)
  if (requestSize !== null && requestSize > MAX_URL_REQUEST_BYTES) {
    throw new StorageValidationError("The URL request body is too large.", 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new StorageValidationError("The request body must be valid JSON.")
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("urls" in body) ||
    !Array.isArray(body.urls) ||
    body.urls.length === 0 ||
    body.urls.some((url) => typeof url !== "string" || !url)
  ) {
    throw new StorageValidationError("The request body must contain a non-empty array of blob URLs.")
  }
  if (body.urls.length > MAX_URLS_PER_REQUEST) {
    throw new StorageValidationError(`You can process up to ${MAX_URLS_PER_REQUEST} URLs per request.`, 413)
  }

  return body.urls
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof StorageValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  console.error("Storage API operation failed.", error)
  return NextResponse.json({ error: "The storage operation failed." }, { status: 500 })
}

export async function uploadRoute(request: Request, policy: UploadPolicy, includeNames = false): Promise<NextResponse> {
  try {
    const files = await readUploadFiles(request, policy)
    const urls = await uploadFiles(files)
    const result: string[] | DocumentItem[] = includeNames
      ? urls.map((url, index) => ({
          name: files[index]?.name ?? "Document",
          url,
        }))
      : urls
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function deleteRoute(request: Request): Promise<NextResponse> {
  try {
    await deleteFiles(await readUrls(request))
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function restoreRoute(request: Request): Promise<NextResponse> {
  try {
    await restoreFiles(await readUrls(request))
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
