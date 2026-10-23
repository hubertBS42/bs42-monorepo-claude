import { FieldDescription } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"

interface FieldHintProps {
  description?: string
  // The value's length out of `max`, shown under the field's right edge
  count?: { length: number; max: number }
}

// A field's description, and its character count beside it when it has one
const FieldHint = ({ description, count }: FieldHintProps) => {
  if (!count) {
    return description ? (
      <FieldDescription>{description}</FieldDescription>
    ) : null
  }

  return (
    <div className="flex items-start gap-4">
      {description && (
        <FieldDescription className="mt-0 flex-1">{description}</FieldDescription>
      )}
      <p
        className={cn(
          "ml-auto shrink-0 text-sm text-muted-foreground tabular-nums",
          count.length >= count.max && "text-destructive"
        )}
      >
        {count.length} / {count.max}
      </p>
    </div>
  )
}

export default FieldHint
