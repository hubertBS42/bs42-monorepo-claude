import { Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { getAppSettings } from "@/lib/app-settings"
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export async function generateMetadata() {
  const s = await getAppSettings()

  return {
    title: { default: s.consoleName, template: `%s | ${s.consoleName}` },
    description: s.consoleDescription ?? undefined,
    openGraph: { siteName: s.consoleName, description: s.consoleDescription ?? undefined },
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
    robots: { index: false },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", "font-sans", inter.variable)}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
