import { ZodError } from "zod"
import { APIError } from "better-auth/api"
import { formatPrismaError } from "@workspace/db"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatError = (error: any): string => {
  if (error instanceof ZodError) {
    return error.issues.map((i) => i.message).join(". ") || "Validation error"
  }
  if (error instanceof APIError) {
    if (Object.hasOwn(error, "body")) {
      return error.body?.message?.toString() || "API Error"
    }
    return error.status?.toString() || "API Error"
  }
  return formatPrismaError(error)
}
