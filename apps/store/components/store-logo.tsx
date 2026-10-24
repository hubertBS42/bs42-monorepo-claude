import { cn } from "@workspace/ui/lib/utils"

// The logo from Settings, with its dark-background version in dark mode when there is one, or the store's name when
// there's no logo
export function StoreLogo({ storeName, logoUrl, logoDarkUrl, className }: { storeName: string; logoUrl: string | null; logoDarkUrl: string | null; className?: string }) {
  if (logoUrl) {
    const classes = cn("h-9 w-auto max-w-25 object-contain", className)
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
        <img src={logoUrl} alt={storeName} className={cn(classes, logoDarkUrl && "dark:hidden")} />
        {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
        {logoDarkUrl && <img src={logoDarkUrl} alt={storeName} className={cn(classes, "hidden dark:block")} />}
      </>
    )
  }
  return <span className={cn("text-xl font-bold tracking-tight", className)}>{storeName}</span>
}
