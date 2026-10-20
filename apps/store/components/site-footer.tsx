import Link from "next/link"
import { Banknote, ShieldCheck, Smartphone, Truck } from "lucide-react"

import { StoreLogo } from "@/components/store-logo"
import type { MenuItem } from "@/lib/menu"

const promises = [
  { icon: Truck, label: "Delivery across Ghana" },
  { icon: Smartphone, label: "Pay with Mobile Money or card" },
  { icon: Banknote, label: "Prices in cedis at today's rate" },
  { icon: ShieldCheck, label: "Secure checkout" },
]

export function SiteFooter({ storeName, storeDescription, logoUrl, menu }: { storeName: string; storeDescription: string | null; logoUrl: string | null; menu: MenuItem[] }) {
  return (
    <footer className="mt-16 bg-muted">
      <div className="border-b">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 lg:grid-cols-4 lg:px-6">
          {promises.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm font-medium">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_3fr] lg:px-6">
        <div className="space-y-3">
          <StoreLogo storeName={storeName} logoUrl={logoUrl} />
          {storeDescription && <p className="max-w-xs text-sm text-muted-foreground">{storeDescription}</p>}
        </div>
        <nav aria-label="Categories">
          <h2 className="mb-3 text-sm font-semibold">Shop</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-3">
            {menu.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground lg:px-6">
          © {new Date().getFullYear()} {storeName}
        </p>
      </div>
    </footer>
  )
}
