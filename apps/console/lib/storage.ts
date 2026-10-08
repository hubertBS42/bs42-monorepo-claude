import type { DocumentItem } from "@workspace/contracts"

async function postFiles(
  url: string,
  method: "DELETE" | "POST",
  urls: string[]
): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  })
  if (!response.ok) {
    throw new Error(`Storage request failed (${response.status}).`)
  }
}

export async function uploadImages(formData: FormData): Promise<string[]> {
  const response = await fetch("/api/storage/images", {
    method: "POST",
    body: formData,
  })
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
  return response.json()
}

export async function deleteImages(urls: string[]): Promise<void> {
  await deleteFiles(urls)
}

export async function restoreImages(urls: string[]): Promise<void> {
  await restoreFiles(urls)
}

export async function uploadDocuments(
  formData: FormData
): Promise<DocumentItem[]> {
  const response = await fetch("/api/storage/documents", {
    method: "POST",
    body: formData,
  })
  if (!response.ok)
    throw new Error(`Document upload failed (${response.status}).`)
  return response.json()
}

export async function deleteDocuments(urls: string[]): Promise<void> {
  await deleteFiles(urls)
}

export async function restoreDocuments(urls: string[]): Promise<void> {
  await restoreFiles(urls)
}

export async function deleteFiles(urls: string[]): Promise<void> {
  await postFiles("/api/storage/files", "DELETE", urls)
}

export async function restoreFiles(urls: string[]): Promise<void> {
  await postFiles("/api/storage/files", "POST", urls)
}
