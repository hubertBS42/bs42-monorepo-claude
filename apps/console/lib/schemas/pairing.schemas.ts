import { z } from "zod"

export const pairingOwnerSchema = z.object({ kind: z.enum(["category", "product"]), id: z.uuid() })

export const addPairingSchema = z.object({ owner: pairingOwnerSchema, productId: z.uuid() })

export const removePairingSchema = z.object({ owner: pairingOwnerSchema, id: z.uuid() })

export const movePairingSchema = z.object({ owner: pairingOwnerSchema, id: z.uuid(), direction: z.enum(["up", "down"]) })

export const searchPairableSchema = z.object({ owner: pairingOwnerSchema, search: z.string().trim().min(1).max(100) })
