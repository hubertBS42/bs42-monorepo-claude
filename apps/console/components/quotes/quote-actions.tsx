"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { useMemberRole } from "@/hooks/use-member-role"
import type { ActionResponse } from "@workspace/contracts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { NumberInputField, SelectField } from "@workspace/forms"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { PaymentMethod } from "@workspace/db/enums"
import FormDialog from "@/components/form-dialog"
import { cancelQuoteAction, placeOrderFromQuoteAction } from "@/lib/actions/quote.actions"
import { placeOrderFormSchema, quoteDeliveryFormSchema } from "@/lib/schemas/quote.schemas"
import { STAFF_ORDER_PAYMENT_METHODS } from "@/lib/staff-payment-methods"
import type { QuoteDetails } from "@/types"

// The quotation's buttons. Checks the viewer's role in the store, or on the platform's pages their system permission;
// every action checks again.

// The quote changed under the page (accepted or cancelled meanwhile, or lapsed): show it as it is now
const REFRESH_CODES = ["NOT_OPEN", "EXPIRED", "NOT_FOUND", "UNAVAILABLE", "STORE_QUOTE", "INCLUDES_INSTALLATION"]

export default function QuoteActions({ quote, storeId }: { quote: QuoteDetails; storeId: string | null }) {
  const { data: session, isPending } = consoleAuthClient.useSession()
  const { role, isLoading: isRoleLoading } = useMemberRole(storeId)

  if (storeId ? isRoleLoading : isPending) return <Skeleton className="h-9 rounded-md" />
  // hasSystemPermission, not checkRolePermission: roles can be comma-separated
  const can = (action: "create" | "update") =>
    storeId ? role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: [action] } }) : hasSystemPermission(session?.user.role, { order: [action] })

  const isOpen = quote.status === "open"
  const buttons = [
    isOpen && can("create") && <PlaceOrder key="place" quote={quote} storeId={storeId} />,
    (isOpen || quote.status === "expired") && can("update") && (
      <ConfirmAction
        key="cancel"
        label="Cancel quotation"
        title={`Cancel ${quote.reference}`}
        description="The customer can no longer accept it."
        confirmLabel="Cancel quotation"
        failureTitle="Unable to cancel the quotation"
        destructive
        run={() => cancelQuoteAction({ quoteId: quote.id, storeId })}
        success={{ title: "Quotation cancelled", description: `${quote.reference} can no longer be accepted.` }}
      />
    ),
    can("create") && (
      <Link key="copy" href={`${storeId ? "/store" : ""}/quotes/create?from=${quote.id}`} className={buttonVariants({ variant: "outline" })}>
        Copy to a new quotation
      </Link>
    ),
  ].filter(Boolean)

  if (!buttons.length) return null
  return <div className="grid gap-2">{buttons}</div>
}

interface ConfirmActionProps {
  label: string
  title: string
  description: string
  confirmLabel: string
  failureTitle: string
  destructive?: boolean
  run: () => Promise<ActionResponse>
  success: { title: string; description: string }
}

function ConfirmAction({ label, title, description, confirmLabel, failureTitle, destructive, run, success }: ConfirmActionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  const handleConfirm = () => {
    startTransition(async () => {
      const response = await run()
      if (!response.success) {
        toast.add({ title: failureTitle, description: response.error, type: "error" })
        if (response.code && REFRESH_CODES.includes(response.code)) {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ ...success, type: "success" })
      router.refresh()
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant={destructive ? "destructive" : "default"}>
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Back</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={(event) => {
              event.preventDefault()
              handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const paymentOptions = STAFF_ORDER_PAYMENT_METHODS.map((method) => ({ label: PAYMENT_METHOD_LABELS[method], value: method }))

// "Place order": how the customer will pay, starting at cash as every staff order does, and on a quote made while no
// delivery fees were set, the fee agreed with the customer
function PlaceOrder({ quote, storeId }: { quote: QuoteDetails; storeId: string | null }) {
  const paymentMethod = PaymentMethod.CASH
  const common = {
    trigger: <Button type="button">Place order</Button>,
    title: `Place an order from ${quote.reference}`,
    submitLabel: "Place order",
    failureTitle: "Unable to place the order",
    refreshOn: REFRESH_CODES,
    success: () => ({ title: "Order placed", description: `${quote.reference} is accepted. Record the payment on its order once it arrives.` }),
  }

  if (!quote.deliveryToConfirm) {
    return (
      <FormDialog
        {...common}
        description="Creates an unpaid order at the quoted prices and reserves its stock. The customer is emailed."
        schema={placeOrderFormSchema}
        values={{ paymentMethod }}
        save={(values) => placeOrderFromQuoteAction({ quoteId: quote.id, storeId, paymentMethod: values.paymentMethod })}
      >
        {(form, isPending) => <SelectField control={form.control} label="The customer will pay by" name="paymentMethod" options={paymentOptions} disabled={isPending} />}
      </FormDialog>
    )
  }
  return (
    <FormDialog
      {...common}
      description="Creates an unpaid order at the quoted prices plus this delivery fee, and reserves its stock. The customer is emailed."
      schema={quoteDeliveryFormSchema}
      values={{ paymentMethod, deliveryGhs: "" }}
      save={(values) => placeOrderFromQuoteAction({ quoteId: quote.id, storeId, paymentMethod: values.paymentMethod, deliveryGhs: values.deliveryGhs })}
    >
      {(form, isPending) => (
        <>
          <SelectField control={form.control} label="The customer will pay by" name="paymentMethod" options={paymentOptions} disabled={isPending} />
          <NumberInputField control={form.control} label="Delivery fee" name="deliveryGhs" step={0.01} min={0} prependText="GH₵" disabled={isPending} />
        </>
      )}
    </FormDialog>
  )
}
