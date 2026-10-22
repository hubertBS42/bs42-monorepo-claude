import { FileText } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { invoiceUrl } from "@workspace/commerce/order-links"

// Opens the order's printable invoice, which lives on the storefront (one invoice for customers and staff alike), in a
// new tab. Its link is signed on the server, as the customer's is.
export function InvoiceButton({ reference, orderId }: { reference: string; orderId: string }) {
  return (
    <Button render={<a href={invoiceUrl(reference, orderId)} target="_blank" rel="noopener noreferrer" />} variant="outline" size="sm">
      <FileText data-icon="inline-start" aria-hidden />
      Invoice
    </Button>
  )
}
