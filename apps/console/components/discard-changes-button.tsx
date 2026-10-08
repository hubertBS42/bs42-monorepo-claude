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
import { useState } from "react"
import { Spinner } from "@workspace/ui/components/spinner"

const DiscardChangesButton = ({
  isLoading,
  isDisabled,
  handleDiscard,
}: {
  isLoading?: boolean
  isDisabled?: boolean
  handleDiscard: () => Promise<void> | void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant={"destructive"}
            size={"sm"}
            disabled={isLoading || isDisabled}
            type="button"
          >
            <Trash /> Discard Changes
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Are you sure you want to leave this page?
            Any unsaved data will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDiscard()
            }}
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DiscardChangesButton
