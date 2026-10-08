"use client"

import { Save } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

const SaveButton = ({
  isLoading,
  isDisabled,
}: {
  isLoading?: boolean
  isDisabled?: boolean
}) => {
  return (
    <Button size={"sm"} type="submit" disabled={isLoading || isDisabled}>
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
