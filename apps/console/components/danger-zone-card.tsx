import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

// Deleting a record, on its edit page: the last card, below the rest (on phones too, so after Status), outlined in red,
// so it's apart from the everyday fields rather than beside them. It's as wide as the main column's cards (the forms'
// lg:grid-cols-3 with lg:col-span-2) and 16px below them like the rest: the forms put it in their gap-8 grid, between
// the cards and the footer, so -mt-4 takes the gap down to the cards' gap-4. The delete buttons are as wide as their
// text from sm up.
export function DangerZoneCard({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <div className="-mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="ring-destructive/30 lg:col-span-2">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
