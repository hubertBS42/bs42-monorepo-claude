import { PaymentMethod } from "@workspace/db/enums"

// How a customer pays staff, or will: the choices on the create-order wizard, Counter Sale, handing over a collection
// and placing an order from a quotation. Online payments are the storefront's own.
export const STAFF_ORDER_PAYMENT_METHODS = [PaymentMethod.BANK_TRANSFER, PaymentMethod.MOBILE_MONEY, PaymentMethod.CASH] as const
