import { cn } from "@workspace/ui/lib/utils"

// The logo from Settings, or the store's name when there's none
export function StoreLogo({ storeName, logoUrl, className }: { storeName: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
    return <img src={logoUrl} alt={storeName} className={cn("h-9 w-auto max-w-25 object-contain", className)} />
  }
  return <span className={cn("text-xl font-bold tracking-tight", className)}>{storeName}</span>
}
