import { randomUUID } from "node:crypto"

import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob"

const DEFAULT_CONTAINER_NAME = "bs42"

export class StorageValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413 | 415 = 400
  ) {
    super(message)
    this.name = "StorageValidationError"
  }
}

let containerClient: ContainerClient | undefined

function getContainerClient(): ContainerClient {
  if (containerClient) return containerClient

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName || !/^[a-z0-9]{3,24}$/.test(accountName)) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME must be set to a valid Azure storage account name.")
  }

  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? DEFAULT_CONTAINER_NAME
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(containerName) || containerName.includes("--")) {
    throw new Error("AZURE_STORAGE_CONTAINER_NAME is not valid.")
  }

  const serviceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential())
  containerClient = serviceClient.getContainerClient(containerName)
  return containerClient
}

function getBlobName(value: string): string {
  const client = getContainerClient()
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new StorageValidationError("The storage URL is malformed.")
  }

  if (url.protocol !== "https:" || url.hostname !== `${client.accountName}.blob.core.windows.net` || url.port || url.username || url.password || url.search || url.hash) {
    throw new StorageValidationError("The URL does not belong to the configured storage account.")
  }

  let segments: string[]
  try {
    segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    throw new StorageValidationError("The storage URL is malformed.")
  }

  const blobName = segments[1]
  if (segments.length !== 2 || segments[0] !== client.containerName || !blobName || blobName.includes("/") || blobName.includes("\\")) {
    throw new StorageValidationError("The URL does not identify a blob in the configured container.")
  }

  return blobName
}

export async function uploadFiles(files: readonly File[]): Promise<string[]> {
  const client = getContainerClient()
  const uploadedNames: string[] = []
  const urls: string[] = []

  try {
    for (const file of files) {
      const blobName = randomUUID()
      const blob = client.getBlockBlobClient(blobName)
      await blob.uploadData(Buffer.from(await file.arrayBuffer()), {
        blobHTTPHeaders: {
          blobContentType: file.type || "application/octet-stream",
        },
      })
      uploadedNames.push(blobName)
      urls.push(blob.url)
    }
  } catch (error) {
    const cleanup = await Promise.allSettled(
      uploadedNames.map((blobName) =>
        client.getBlockBlobClient(blobName).deleteIfExists({
          deleteSnapshots: "include",
        })
      )
    )
    const cleanupErrors = cleanup.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (cleanupErrors.length > 0) {
      throw new AggregateError([error, ...cleanupErrors], "Upload failed and some uploaded blobs could not be cleaned up.", { cause: error })
    }
    throw error
  }

  return urls
}

export async function deleteFiles(urls: readonly string[]): Promise<void> {
  const client = getContainerClient()
  const blobNames = urls.map(getBlobName)

  await Promise.all(
    blobNames.map((name) =>
      client.getBlockBlobClient(name).deleteIfExists({
        deleteSnapshots: "include",
      })
    )
  )
}

export async function restoreFiles(urls: readonly string[]): Promise<void> {
  const client = getContainerClient()
  const blobNames = urls.map(getBlobName)

  await Promise.all(blobNames.map((name) => client.getBlockBlobClient(name).undelete()))
}

export function isManagedFileUrl(value: string): boolean {
  try {
    getBlobName(value)
    return true
  } catch (error) {
    if (error instanceof StorageValidationError) return false
    throw error
  }
}

/**
 * Best-effort delete for files a database change no longer references. Run it after the change has committed:
 * a leftover blob is far cheaper than failing a request whose data is already saved, so errors are logged, not thrown.
 * Empty values and URLs outside our container are skipped.
 */
export async function removeFiles(urls: readonly (string | null | undefined)[], context = "File cleanup"): Promise<void> {
  try {
    const files = urls.filter((url): url is string => !!url && isManagedFileUrl(url))
    if (files.length > 0) await deleteFiles(files)
  } catch (error) {
    console.error(`${context} failed:`, error)
  }
}

export interface StoredFile {
  url: string
  lastModified: Date
}

/** Every blob in the container, one page at a time. */
export async function* listFiles(): AsyncGenerator<StoredFile> {
  const client = getContainerClient()
  for await (const blob of client.listBlobsFlat()) {
    yield { url: client.getBlockBlobClient(blob.name).url, lastModified: blob.properties.lastModified }
  }
}
