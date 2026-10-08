import { unstable_cache } from "next/cache"
import { readAppSettings, resolveConsoleName } from "@workspace/db"

export const getAppSettings = unstable_cache(readAppSettings, ["app-settings"], {
  tags: ["app-settings"],
  revalidate: 60, // the store picks up console changes within a minute
})

export async function getConsoleName() {
  return resolveConsoleName(await getAppSettings())
}
