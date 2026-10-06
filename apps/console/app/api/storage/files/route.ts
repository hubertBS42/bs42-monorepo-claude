import { deleteRoute, restoreRoute } from "@/lib/storage-api"

export function DELETE(request: Request) {
  return deleteRoute(request)
}

export function POST(request: Request) {
  return restoreRoute(request)
}
