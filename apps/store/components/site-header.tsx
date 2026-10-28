import Link from "next/link"
import ThemeToggle from "@workspace/ui/components/theme-toggle"

import { AccountButton } from "@/components/account/account-button"
import { BasketButton } from "@/components/basket/basket-button"
import { CategoryMenu } from "@/components/category-menu"
import { MobileMenu } from "@/components/mobile-menu"
import { SearchForm } from "@/components/search-form"
import { StoreLogo } from "@/components/store-logo"
import { TopBar } from "@/components/top-bar"
import { WishListButton } from "@/components/wish-list/wish-list-button"
import type { FooterContact } from "@/components/site-footer"
import type { MenuItem } from "@/lib/menu"

export function SiteHeader({
  storeName,
  logoUrl,
  logoDarkUrl,
  menu,
  contact,
}: {
  storeName: string
  logoUrl: string | null
  logoDarkUrl: string | null
  menu: MenuItem[]
  contact: Pick<FooterContact, "contactPhone" | "contactEmail">
}) {
  return (
    <>
      <TopBar contact={contact} />
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:gap-6 lg:px-6">
          {/* The two sides share the space left equally, so the search sits in the middle, as the old bs42.net's links did */}
          <div className="flex flex-1 items-center gap-3">
            <MobileMenu items={menu} storeName={storeName} />
            <Link href="/" className="shrink-0">
              <StoreLogo storeName={storeName} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} />
            </Link>
          </div>
          <SearchForm className="hidden w-full max-w-xl md:block" />
          <div className="flex flex-1 items-center justify-end gap-1">
            <ThemeToggle />
            <AccountButton />
            {/* On phones the account menu has the link (it stays mounted to save an item after signing in) */}
            <WishListButton className="max-sm:hidden" />
            <BasketButton />
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchForm />
        </div>
        <div className="hidden border-t lg:block">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <CategoryMenu items={menu} />
          </div>
        </div>
      </header>
    </>
  )
}
