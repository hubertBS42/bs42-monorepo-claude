"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

// Each sort's URL comes from the server, which knows the page's other parameters
export function SortSelect({ value, options }: { value: string; options: { value: string; label: string; href: string }[] }) {
  const router = useRouter()

  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next)
        if (option) router.push(option.href, { scroll: false })
      }}
    >
      <SelectTrigger className="w-48" aria-label="Sort by">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
