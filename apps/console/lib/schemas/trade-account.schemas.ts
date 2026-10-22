import { z } from "zod"
import { TradeAccountStatus } from "@workspace/db/enums"
import { decimalSchema } from "./product.schemas"

// Reviewing a trade account: approving with a discount (a percentage above 0 and below 100), rejecting with the reason
// the customer is shown, suspending or reinstating. The page sends the status it showed (STATUS_CHANGED).
export const tradeReviewFormSchema = z
  .object({
    status: z.enum(TradeAccountStatus),
    // Empty when the decision doesn't set one
    percent: z.union([decimalSchema, z.literal("")]),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters"),
  })
  .superRefine((data, ctx) => {
    if (data.status === TradeAccountStatus.APPROVED && (data.percent === "" || data.percent <= 0 || data.percent >= 100)) {
      ctx.addIssue({ code: "custom", message: "Enter a discount above 0% and below 100%", path: ["percent"] })
    }
    if (data.status === TradeAccountStatus.REJECTED && !data.reason) ctx.addIssue({ code: "custom", message: "Give the reason, which the customer is shown", path: ["reason"] })
  })

export const reviewTradeAccountSchema = tradeReviewFormSchema.safeExtend({
  accountId: z.uuid("Invalid trade account ID"),
  currentStatus: z.enum(TradeAccountStatus),
})
