import { Input } from "@workspace/ui/components/input"

const NumberRangeFilter = ({
  minKey,
  maxKey,
  values,
  setValues,
  applyFilters,
  isPending,
}: {
  minKey: string
  maxKey: string
  values: Record<string, string>
  setValues: (v: Record<string, string>) => void
  applyFilters: (overrides?: Record<string, string>) => void
  isPending: boolean
}) => {
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        placeholder="Min"
        value={values[minKey] ?? ""}
        className="h-8"
        onChange={(e) => setValues({ ...values, [minKey]: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        disabled={isPending}
      />
      <Input
        type="number"
        placeholder="Max"
        value={values[maxKey] ?? ""}
        className="h-8"
        onChange={(e) => setValues({ ...values, [maxKey]: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        disabled={isPending}
      />
    </div>
  )
}

export default NumberRangeFilter
