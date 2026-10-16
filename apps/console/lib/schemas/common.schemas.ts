import { z } from "zod"

// http(s) only, so a stored link can't be a javascript: URL. An empty field is saved as null.
export const optionalHttpUrl = (message: string) => z.union([z.httpUrl(message), z.literal("").transform(() => null)]).nullable()
