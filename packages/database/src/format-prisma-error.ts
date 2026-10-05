// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatPrismaError = (error: any): string => {
  if (error.name === "PrismaClientKnownRequestError") {
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "Field"
      return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    }
    return error.message.split(":")[1].replace(/\s+/g, " ").trim()
  }
  if (typeof error?.message === "string") return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return "An unknown error occurred"
  }
}
