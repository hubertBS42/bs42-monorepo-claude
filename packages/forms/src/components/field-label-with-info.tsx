import { FieldLabel } from "@workspace/ui/components/field"
import { InfoTip } from "@workspace/ui/components/info-tip"

interface FieldLabelWithInfoProps {
  htmlFor: string
  label: string
  // More about the field, behind an ⓘ beside the label
  info?: string
  className?: string
}

// A field's label, with its ⓘ beside it rather than inside it, so the button stays out of the field's accessible name
// and clicking it doesn't focus the field
const FieldLabelWithInfo = ({ htmlFor, label, info, className }: FieldLabelWithInfoProps) => {
  const fieldLabel = (
    <FieldLabel htmlFor={htmlFor} className={className}>
      {label}
    </FieldLabel>
  )
  if (!info) return fieldLabel

  return (
    <div className="flex items-center gap-1.5">
      {fieldLabel}
      <InfoTip about={label}>{info}</InfoTip>
    </div>
  )
}

export default FieldLabelWithInfo
