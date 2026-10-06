import { documentUploadPolicy, uploadRoute } from "@/lib/storage-api"

export function POST(request: Request) {
  return uploadRoute(request, documentUploadPolicy, true)
}
