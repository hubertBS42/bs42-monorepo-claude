import type { CollectionListItem } from "@/types"

// A plain module, so the server page and the client table can both use it
export const STATE_LABELS: Record<CollectionListItem["state"], string> = {
  coming: "Items on the way",
  here: "Everything here",
  ready: "Customer told",
  collected: "Collected",
}
