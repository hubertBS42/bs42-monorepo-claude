import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"

import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob"

const DEFAULT_CONTAINER_NAME = "bs42-public"
// Files only signed-in staff may open (purchase order invoices and receipts): no public access, served by the console
const DEFAULT_PRIVATE_CONTAINER_NAME = "bs42-private"

export class StorageValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413 | 415 = 400
  ) {
    super(message)
    this.name = "StorageValidationError"
  }
}

type ContainerKind = "public" | "private"

let serviceClient: BlobServiceClient | undefined
const containerClients = new Map<ContainerKind, ContainerClient>()

function getServiceClient(): BlobServiceClient {
  if (serviceClient) return serviceClient

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName || !/^[a-z0-9]{3,24}$/.test(accountName)) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME must be set to a valid Azure storage account name.")
  }

  serviceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential())
  return serviceClient
}

function getContainerClient(kind: ContainerKind = "public"): ContainerClient {
  const cached = containerClients.get(kind)
  if (cached) return cached

  const [variable, fallback] = kind === "public" ? ["AZURE_STORAGE_CONTAINER_NAME", DEFAULT_CONTAINER_NAME] : ["AZURE_STORAGE_PRIVATE_CONTAINER_NAME", DEFAULT_PRIVATE_CONTAINER_NAME]
  const containerName = process.env[variable] ?? fallback
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(containerName) || containerName.includes("--")) {
    throw new Error(`${variable} is not valid.`)
  }

  const client = getServiceClient().getContainerClient(containerName)
  containerClients.set(kind, client)
  return client
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

// Uploads each file under a new random name; if one fails, those already uploaded are removed again
async function uploadBlobs(client: ContainerClient, files: readonly File[]): Promise<string[]> {
  const uploadedNames: string[] = []

  try {
    for (const file of files) {
      const blobName = randomUUID()
      await client.getBlockBlobClient(blobName).uploadData(Buffer.from(await file.arrayBuffer()), {
        blobHTTPHeaders: {
          blobContentType: file.type || "application/octet-stream",
        },
      })
      uploadedNames.push(blobName)
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

  return uploadedNames
}

export async function uploadFiles(files: readonly File[]): Promise<string[]> {
  const client = getContainerClient()
  const names = await uploadBlobs(client, files)
  return names.map((name) => client.getBlockBlobClient(name).url)
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

// Private files: stored by blob name (a random UUID), never by URL, since nobody opens them by their address

const PRIVATE_BLOB_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function checkPrivateBlobName(name: string): string {
  if (!PRIVATE_BLOB_NAME.test(name)) throw new StorageValidationError("Not a private file's name.")
  return name
}

/** Uploads files to the private container and returns their blob names. */
export async function uploadPrivateFiles(files: readonly File[]): Promise<string[]> {
  return uploadBlobs(getContainerClient("private"), files)
}

export interface PrivateFileContent {
  body: ReadableStream<Uint8Array>
  contentLength: number | undefined
}

/** A private file's content, for a route that has checked the reader may see it. */
export async function readPrivateFile(name: string): Promise<PrivateFileContent> {
  const response = await getContainerClient("private").getBlockBlobClient(checkPrivateBlobName(name)).download()
  if (!response.readableStreamBody) throw new Error("The file has no content.")
  return { body: Readable.toWeb(response.readableStreamBody as Readable) as ReadableStream<Uint8Array>, contentLength: response.contentLength }
}

export async function deletePrivateFiles(names: readonly string[]): Promise<void> {
  const client = getContainerClient("private")
  await Promise.all(names.map((name) => client.getBlockBlobClient(checkPrivateBlobName(name)).deleteIfExists({ deleteSnapshots: "include" })))
}

/** Best-effort delete after a change has committed, like removeFiles: errors are logged, not thrown. */
export async function removePrivateFiles(names: readonly string[], context = "Private file cleanup"): Promise<void> {
  try {
    if (names.length > 0) await deletePrivateFiles(names)
  } catch (error) {
    console.error(`${context} failed:`, error)
  }
}

export interface StoredPrivateFile {
  name: string
  lastModified: Date
}

/** Every blob in the private container, one page at a time. */
export async function* listPrivateFiles(): AsyncGenerator<StoredPrivateFile> {
  for await (const blob of getContainerClient("private").listBlobsFlat()) {
    yield { name: blob.name, lastModified: blob.properties.lastModified }
  }
}
