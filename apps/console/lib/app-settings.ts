import { unstable_cache } from "next/cache"
import { readAppSettings, resolveConsoleName } from "@workspace/db"

export const getAppSettings = unstable_cache(readAppSettings, ["app-settings"], {
  tags: ["app-settings"],
  // Saving settings refreshes this cache with updateTag, so this is only a fallback. It's the console's cache:
  // the storefront will need its own when it reads settings.
  revalidate: 60,
})

export async function getConsoleName() {
  return resolveConsoleName(await getAppSettings())
}
