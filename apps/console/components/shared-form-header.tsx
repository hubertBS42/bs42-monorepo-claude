import BackButton from "./back-button"
import DiscardChangesButton from "./discard-changes-button"
import SaveButton from "./save-button"

interface ResourceFormHeaderProps {
  heading: string
  description: string
  backTo: string
  isPending: boolean
  isDirty: boolean
  handleDiscard: () => Promise<void> | void
}
const ResourceFormHeader = ({ heading, description, backTo, isPending, isDirty, handleDiscard }: ResourceFormHeaderProps) => {
  return (
    <div className="flex items-end">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">{heading}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="hidden items-center gap-2 md:ml-auto md:flex">
        {isDirty ? <DiscardChangesButton isLoading={isPending} handleDiscard={handleDiscard} /> : <BackButton link={backTo} />}
        <SaveButton isLoading={isPending} isDisabled={!isDirty} />
      </div>
    </div>
  )
}
export default ResourceFormHeader
