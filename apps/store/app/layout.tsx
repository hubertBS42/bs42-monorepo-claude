import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { authURLs } from "@workspace/auth/constants"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import { Toaster } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { CompareBar } from "@/components/compare/compare-bar"
import { legalLinks } from "@/components/legal-consent"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getCategoryTree } from "@/lib/data/categories"
import { getMenuItems } from "@/lib/menu"
import { getAppSettings, getLegalPages, getStoreName } from "@/lib/settings"

// Pages without search params (the homepage) are built ahead, then rebuilt at most this often, as the data caches
// expire (lib/settings.ts)
export const revalidate = 60

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export async function generateMetadata() {
  const [settings, storeName] = await Promise.all([getAppSettings(), getStoreName()])
  return {
    // Canonical links and Open Graph images are relative to the storefront's address
    metadataBase: new URL(authURLs.store),
    title: { default: storeName, template: `%s | ${storeName}` },
    description: settings.storeDescription ?? undefined,
    openGraph: { siteName: storeName, description: settings.storeDescription ?? undefined },
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [settings, storeName, tree, legal] = await Promise.all([getAppSettings(), getStoreName(), getCategoryTree(), getLegalPages()])
  const menu = getMenuItems(tree)

  return (
    <html lang="en-GH" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}>
      <body className="flex min-h-svh flex-col">
        <ThemeProvider>
          <SiteHeader storeName={storeName} logoUrl={settings.logoUrl} logoDarkUrl={settings.logoDarkUrl} menu={menu} />
          <main className="flex-1">{children}</main>
          <SiteFooter storeName={storeName} storeDescription={settings.storeDescription} logoUrl={settings.logoUrl} logoDarkUrl={settings.logoDarkUrl} menu={menu} legal={legalLinks(legal)} />
          <CompareBar />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
