import BackButton from "./back-button"
import SaveButton from "./save-button"

interface ResourceFormHeaderProps {
  heading: string
  description: string
  backTo: string
  isPending: boolean
  isDirty: boolean
}
const ResourceFormHeader = ({ heading, description, backTo, isPending, isDirty }: ResourceFormHeaderProps) => {
  return (
    <div className="flex items-end">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">{heading}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {/* Once something changes, Discard and Save are on the footer's bar, pinned to the bottom of the screen.
          invisible, not hidden, so the header keeps its height and the title doesn't move. */}
      <div className={`hidden items-center gap-2 md:ml-auto md:flex ${isDirty ? "invisible" : ""}`} aria-hidden={isDirty || undefined}>
        <BackButton link={backTo} />
        <SaveButton isLoading={isPending} isDisabled />
      </div>
    </div>
  )
}
export default ResourceFormHeader
