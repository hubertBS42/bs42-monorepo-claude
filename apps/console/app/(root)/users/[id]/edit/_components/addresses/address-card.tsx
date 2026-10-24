"use client"

import { Badge } from "@workspace/ui/components/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuGroup } from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { MoreVertical } from "lucide-react"
import { useState, useTransition } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { deleteAddressAction } from "@/lib/actions/user.actions"
import { toast } from "@workspace/ui/components/toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import EditAddressDialog from "./edit-address-dialog"
import { useRouter } from "next/navigation"
import type { Address } from "@workspace/db/client"
import { Spinner } from "@workspace/ui/components/spinner"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"

const AddressCard = ({ address }: { address: Address }) => {
  const [dialogIsOpen, setDialogIsOpen] = useState(false)
  const [alertDialogIsOpen, setAlertDialogIsOpen] = useState(false)
  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const handleDeleteAddress = () => {
    startTransition(async () => {
      const res = await deleteAddressAction(address.id)

      if (!res.success) {
        toast.add({
          title: "Operation failed",
          description: res.error,
          type: "error",
        })
        return
      }

      setAlertDialogIsOpen(false)
      router.refresh()
      toast.add({
        title: "Operation successful",
        description: "Address deleted successfully.",
        type: "success",
      })
    })
  }

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle className="flex w-full justify-between">
          {address.name}
          <div className="flex items-center gap-2">
            {address.isDefault && <Badge>Default</Badge>}
            {/* Base UI menu items use onClick (there's no onSelect) and close the menu themselves */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant={"ghost"} size={"icon-xs"}>
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setDialogIsOpen(true)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setAlertDialogIsOpen(true)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Edit address dialog */}
            <Dialog open={dialogIsOpen} onOpenChange={setDialogIsOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit address</DialogTitle>
                  <DialogDescription>Update this delivery address.</DialogDescription>
                </DialogHeader>
                <EditAddressDialog address={address} setDialogIsOpen={setDialogIsOpen} />
              </DialogContent>
            </Dialog>
            {/* Delete address alert dialog */}
            <AlertDialog open={alertDialogIsOpen} onOpenChange={setAlertDialogIsOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{address.name}, {address.line1}, {address.town}&quot;.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAddress} disabled={isPending}>
                    {isPending ? <Spinner /> : "Continue"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ItemTitle>
        <ItemDescription className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">{address.phone}</span>
          <span className="text-xs text-muted-foreground">{address.line1}</span>
          {address.line2 && <span className="text-xs text-muted-foreground">{address.line2}</span>}
          <span className="text-xs text-muted-foreground">
            {address.town}, {address.region}
          </span>
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}
export default AddressCard
