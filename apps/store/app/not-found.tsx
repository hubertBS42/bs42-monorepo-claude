import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

import { SearchForm } from "@/components/search-form"

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 pt-20 pb-16">
      <h1 className="text-3xl font-bold tracking-tight">We can't find that page</h1>
      <p className="text-muted-foreground">It may have moved, or what was on it isn't on sale any more. Try a search instead.</p>
      <SearchForm />
      <Button render={<Link href="/" />} variant="outline">
        Back to the homepage
      </Button>
    </div>
  )
}
