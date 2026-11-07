import { z } from "zod"

import { checkFulfilment, fulfilmentFields } from "./address.schemas"

// Making a quotation: who it's addressed to, and the delivery the order would make (its fee is part of the quote), or
// collection from the store
export const quoteRequestSchema = z.object(fulfilmentFields).superRefine(checkFulfilment)

export type QuoteRequestValues = z.input<typeof quoteRequestSchema>
