import { cn } from "@workspace/ui/lib/utils"
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

// A page form's buttons. A clean form shows Back and Save here on phones only (the header has them on wider screens).
// Once something changes, it's a bar pinned to the bottom of the screen on every size, so Save never scrolls out of
// reach, and the header hides its own buttons. Sticky, not fixed: it settles into place at the end of the page, so it
// never covers the last card, and it spans the content (the negative margins undo the page's padding), not the sidebar.
// min-w-0: the form is a grid, which would otherwise widen to fit the bar on a narrow phone (the words wrap instead).
const ResourceFormFooter = ({ backTo, isPending, isDirty, handleDiscard, form }: ResourceFormFooterProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isDirty
          ? "sticky bottom-0 z-20 -mx-4 min-w-0 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6"
          : "justify-center md:hidden"
      )}
    >
      {isDirty ? (
        <>
          <p className="mr-auto min-w-0 text-sm leading-tight font-medium" aria-live="polite">
            Unsaved changes
          </p>
          <DiscardChangesButton isLoading={isPending} handleDiscard={handleDiscard} />
        </>
      ) : (
        <BackButton link={backTo} />
      )}
      <SaveButton isLoading={isPending} isDisabled={!isDirty} form={form} />
    </div>
  )
}
export default ResourceFormFooter
