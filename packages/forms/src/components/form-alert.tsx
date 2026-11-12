import type { ReactNode } from "react"
import { CircleAlert, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"

// A message about the whole form, not one field: why a sign-in failed, or a
// notice such as "we've sent you a new link". Errors are in the destructive
// colour; notices aren't, since nothing went wrong. A form's root error set
// with type "notice" (form.setError("root", { type: "notice", message })) shows
// as a notice through formAlertTone.
export function FormAlert({ title, children, tone = "error" }: { title: string; children: ReactNode; tone?: "error" | "notice" }) {
  const isError = tone === "error"
  return (
    <Alert variant={isError ? "destructive" : "default"} role={isError ? "alert" : "status"}>
      {isError ? <CircleAlert aria-hidden /> : <Info aria-hidden />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

// The tone for a react-hook-form root error
export function formAlertTone(error: { type?: string | number }) {
  return error.type === "notice" ? "notice" : "error"
}
