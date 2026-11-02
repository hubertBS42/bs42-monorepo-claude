import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

// Deleting a record, on its edit page: the last card, full width below the rest, outlined in red, so it's apart from
// the everyday fields rather than beside them. The delete buttons are as wide as their text from sm up.
export function DangerZoneCard({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
