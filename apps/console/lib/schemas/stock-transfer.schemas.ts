import z from "zod"

// Stock transfers between two stores the sender manages

export const STOCK_TRANSFER_LIMITS = { notes: 500, reason: 500, lines: 100 } as const

const optionalNote = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .nullable()
    .transform((value) => value || null)

export const stockTransferLineSchema = z.object({
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: z.number("Enter a quantity").int("Whole units only").min(1, "At least 1"),
})

export const stockTransferFormSchema = z.object({
  toStoreId: z.uuid("Choose the store to send to"),
  notes: optionalNote(STOCK_TRANSFER_LIMITS.notes),
  lines: z
    .array(stockTransferLineSchema)
    .min(1, "Add at least one item")
    .max(STOCK_TRANSFER_LIMITS.lines, `At most ${STOCK_TRANSFER_LIMITS.lines} lines`)
    // One line per row: the same row twice would take its stock twice
    .refine((lines) => new Set(lines.map((line) => `${line.listingId}:${line.listingVariantId ?? ""}`)).size === lines.length, "Each item can only be on the transfer once"),
})

export const createStockTransferSchema = stockTransferFormSchema.extend({ fromStoreId: z.uuid("Invalid store ID") })

export const receiveStockTransferFormSchema = z.object({
  items: z.array(z.object({ itemId: z.uuid(), quantity: z.number("Enter how many arrived").int("Whole units only").min(0, "0 or more") })).min(1),
  note: optionalNote(STOCK_TRANSFER_LIMITS.notes),
})

export const receiveStockTransferSchema = receiveStockTransferFormSchema.extend({ storeId: z.uuid(), transferId: z.uuid() })

export const cancelStockTransferFormSchema = z.object({
  reason: z.string().trim().min(1, "Say why").max(STOCK_TRANSFER_LIMITS.reason, `At most ${STOCK_TRANSFER_LIMITS.reason} characters`),
})

export const cancelStockTransferSchema = cancelStockTransferFormSchema.extend({ storeId: z.uuid(), transferId: z.uuid() })

// What the sender typed in the form's search, for rows to send
export const searchTransferableSchema = z.object({ fromStoreId: z.uuid(), toStoreId: z.uuid().nullable(), search: z.string().trim().max(100) })
