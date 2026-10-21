import { storeAuth } from "@workspace/auth/store"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(storeAuth)
