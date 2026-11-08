import { Badge } from "@workspace/ui/components/badge"

// Solid and the same in both themes: it sits on photo tiles, which stay white in dark mode
export function SaleBadge() {
  return <Badge className="bg-red-600 text-white dark:bg-red-600">Sale</Badge>
}
