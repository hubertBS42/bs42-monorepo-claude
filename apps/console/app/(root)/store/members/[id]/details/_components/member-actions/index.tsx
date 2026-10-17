import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import RemoveMember, { type RemovableMember } from "./remove-member"

// Only rendered when the viewer can remove this member; the page decides
const MemberActions = ({ member }: { member: RemovableMember }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Remove this member from the store.</CardDescription>
      </CardHeader>
      <CardContent>
        <RemoveMember member={member} />
      </CardContent>
    </Card>
  )
}
export default MemberActions
