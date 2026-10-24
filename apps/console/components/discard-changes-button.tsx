"use client"

import { Trash } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { useState, useTransition } from "react"
import { Spinner } from "@workspace/ui/components/spinner"

const DiscardChangesButton = ({ isLoading, isDisabled, handleDiscard }: { isLoading?: boolean; isDisabled?: boolean; handleDiscard: () => Promise<void> | void }) => {
  const [isOpen, setIsOpen] = useState(false)
  // Discarding can remove uploads before it leaves, and router.push in a transition stays pending until the next page
  // has rendered, so the spinner shows for all of it, not only while the form is saving
  const [isDiscarding, startTransition] = useTransition()
  const isBusy = isLoading || isDiscarding
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={"destructive"} size={"sm"} disabled={isLoading || isDisabled} type="button">
            <Trash /> Discard Changes
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>Your unsaved changes will be lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                await handleDiscard()
              })
            }}
            disabled={isBusy}
          >
            {isBusy ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DiscardChangesButton
