"use client"

import { ChevronLeft } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"
import Link from "next/link"

const BackButton = ({ link }: { link: string }) => {
  return (
    <Link
      href={link}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ChevronLeft className="size-4" /> Back
    </Link>
  )
}

export default BackButton
