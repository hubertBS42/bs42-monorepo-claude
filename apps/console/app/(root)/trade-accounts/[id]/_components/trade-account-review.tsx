"use client"

import { TradeAccountStatus } from "@workspace/db/enums"
import { NumberInputField, TextareaField } from "@workspace/forms"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import FormDialog from "@/components/form-dialog"
import { reviewTradeAccountAction } from "@/lib/actions/trade-account.actions"
import { tradeReviewFormSchema } from "@/lib/schemas/trade-account.schemas"
import { nextTradeStatuses } from "@workspace/commerce/trade-account-status"

// The decisions staff can make on a trade account from where it is. Each dialog sends the status the page showed.

const REFRESH_ON = ["STATUS_CHANGED", "NOT_FOUND"]

interface TradeAccountReviewProps {
  account: { id: string; companyName: string; status: TradeAccountStatus; discountPercent: string | null }
}

export default function TradeAccountReview({ account }: TradeAccountReviewProps) {
  const { data: session, isPending } = consoleAuthClient.useSession()
  if (isPending) return <Skeleton className="h-9 rounded-md" />
  if (!hasSystemPermission(session?.user.role, { tradeAccount: ["update"] })) return <p className="text-sm text-muted-foreground">Your role can&apos;t review trade accounts.</p>

  const next = nextTradeStatuses(account.status)
  if (next.length === 0) return <p className="text-sm text-muted-foreground">The customer can apply again with corrected details.</p>

  const target = { accountId: account.id, currentStatus: account.status }
  const percent = account.discountPercent === null ? ("" as const) : Number(account.discountPercent)
  const save = (values: { status: TradeAccountStatus; percent: number | ""; reason: string }) => reviewTradeAccountAction({ ...target, ...values })

  const approveDialog = (title: string, label: string, description: string, variant: "default" | "outline") => (
    <FormDialog
      trigger={
        <Button type="button" variant={variant}>
          {label}
        </Button>
      }
      title={title}
      description={description}
      submitLabel={label}
      failureTitle="Unable to update the trade account"
      refreshOn={REFRESH_ON}
      schema={tradeReviewFormSchema}
      values={{ status: TradeAccountStatus.APPROVED, percent, reason: "" }}
      save={save}
      success={(values) => ({ title: "Trade account updated", description: `${account.companyName} gets ${values.percent}% off.` })}
    >
      {(form, isPending) => <NumberInputField control={form.control} label="Discount (%)" name="percent" step={0.01} min={0.01} max={99.99} disabled={isPending} />}
    </FormDialog>
  )

  return (
    <div className="grid gap-2">
      {account.status === TradeAccountStatus.PENDING &&
        approveDialog("Approve the application", "Approve", "The customer is emailed, and every order they place from now on gets this discount, before tax.", "default")}
      {account.status === TradeAccountStatus.APPROVED && approveDialog("Change the discount", "Change discount", "For orders placed from now on; past orders keep theirs.", "outline")}
      {account.status === TradeAccountStatus.SUSPENDED && approveDialog("Reinstate the account", "Reinstate", "The discount applies to their orders again.", "default")}

      {next.includes(TradeAccountStatus.REJECTED) && (
        <FormDialog
          trigger={
            <Button type="button" variant="outline">
              Reject
            </Button>
          }
          title="Reject the application"
          description="The customer is emailed the reason and can reapply."
          submitLabel="Reject"
          failureTitle="Unable to reject the application"
          refreshOn={REFRESH_ON}
          destructive
          schema={tradeReviewFormSchema}
          values={{ status: TradeAccountStatus.REJECTED, percent: "", reason: "" }}
          save={save}
          success={() => ({ title: "Application rejected", description: "The customer has been emailed the reason." })}
        >
          {(form, isPending) => <TextareaField control={form.control} label="Reason" name="reason" placeholder="e.g. The TIN doesn't match the company's name" disabled={isPending} />}
        </FormDialog>
      )}

      {next.includes(TradeAccountStatus.SUSPENDED) && (
        <FormDialog
          trigger={
            <Button type="button" variant="destructive">
              Suspend
            </Button>
          }
          title="Suspend the account"
          description="No discount until reinstated. The customer isn't emailed."
          submitLabel="Suspend"
          failureTitle="Unable to suspend the account"
          refreshOn={REFRESH_ON}
          destructive
          schema={tradeReviewFormSchema}
          values={{ status: TradeAccountStatus.SUSPENDED, percent: "", reason: "" }}
          save={save}
          success={() => ({ title: "Account suspended", description: `${account.companyName} pays the usual prices for now.` })}
        >
          {() => null}
        </FormDialog>
      )}
    </div>
  )
}
