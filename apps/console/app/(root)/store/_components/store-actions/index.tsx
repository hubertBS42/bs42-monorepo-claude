import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import DeleteStore from "@/components/delete-store"
import type { Store } from "@/types"
import LeaveStore from "./leave-store"

interface StoreActionsProps {
  store: Store
  isPlatformStaff: boolean
  // Whether the viewer's store role has organization: ["delete"] (only owners do)
  canDelete: boolean
}

// Platform staff are added to every store automatically, so they don't leave stores; they see
// Delete, which explains itself when their store role can't delete. Store staff can leave,
// and owners can also delete their store.
const StoreActions = ({ store, isPlatformStaff, canDelete }: StoreActionsProps) => {
  const showDelete = isPlatformStaff || canDelete
  const showLeave = !isPlatformStaff

  const description = showDelete && showLeave ? "Leave this store, or permanently delete it and all its data." : showDelete ? "Permanently delete this store and all its data." : "Leave this store."

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-y-2">
        {showLeave && <LeaveStore store={store} />}
        {showDelete && <DeleteStore store={store} />}
      </CardContent>
    </Card>
  )
}
export default StoreActions
