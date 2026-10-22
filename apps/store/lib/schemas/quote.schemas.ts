import { z } from "zod"

import { addressFields, checkArea } from "./address.schemas"

// Making a quotation: who it's addressed to, and the delivery the order would make (its fee is part of the quote)
export const quoteRequestSchema = z.object(addressFields).superRefine(checkArea)

export type QuoteRequestValues = z.input<typeof quoteRequestSchema>
