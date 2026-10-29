import BackButton from "./back-button"
import DiscardChangesButton from "./discard-changes-button"
import SaveButton from "./save-button"

interface ResourceFormFooterProps {
  backTo: string
  isPending: boolean
  isDirty: boolean
  handleDiscard: () => Promise<void> | void
  // The id of the form Save submits, when the footer is rendered outside that form
  form?: string
}
const ResourceFormFooter = ({ backTo, isPending, isDirty, handleDiscard, form }: ResourceFormFooterProps) => {
  return (
    <div className="flex items-center justify-center gap-2 md:hidden">
      {isDirty ? <DiscardChangesButton isLoading={isPending} handleDiscard={handleDiscard} /> : <BackButton link={backTo} />}
      <SaveButton isLoading={isPending} isDisabled={!isDirty} form={form} />
    </div>
  )
}
export default ResourceFormFooter
