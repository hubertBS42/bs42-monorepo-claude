"use client"

import { Save } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

const SaveButton = ({
  isLoading,
  isDisabled,
  form,
}: {
  isLoading?: boolean
  isDisabled?: boolean
  // The id of the form it submits, when it's rendered outside that form
  form?: string
}) => {
  return (
    <Button size={"sm"} type="submit" form={form} disabled={isLoading || isDisabled}>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Save /> Save
        </>
      )}
    </Button>
  )
}

export default SaveButton
