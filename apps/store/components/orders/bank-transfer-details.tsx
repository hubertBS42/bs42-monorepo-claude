// Where to send a bank transfer for an order staff made (Settings → Pricing), with the reference to quote. On the order
// page and the invoice while the order is unpaid (awaitsBankTransfer).
export function BankTransferDetails({ details, reference }: { details: string | null; reference: string }) {
  return (
    <div className="space-y-1">
      {details ? <p className="whitespace-pre-line">{details}</p> : <p className="text-muted-foreground">We&apos;ll send you our bank details.</p>}
      <p className="text-muted-foreground">
        Use <span className="font-mono font-medium text-foreground">{reference}</span> as the payment reference.
      </p>
    </div>
  )
}
