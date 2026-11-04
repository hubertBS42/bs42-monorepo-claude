import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatCurrency } from "@workspace/utils/currency"

export const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

// One of a report's headline figures
export function ReportStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{note}</CardFooter>
    </Card>
  )
}
