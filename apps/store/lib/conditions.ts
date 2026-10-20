import type { Condition } from "@workspace/db/enums"

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: "New",
  REFURBISHED: "Refurbished",
  USED_LIKE_NEW: "Used: like new",
  USED_GOOD: "Used: good",
  USED_FAIR: "Used: fair",
}
