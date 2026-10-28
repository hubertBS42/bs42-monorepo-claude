"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet"

import type { MenuItem } from "@/lib/menu"
import { siteLinks } from "@/lib/site-links"

// The category menu on small screens: a sheet with each top category folding open, then the site's own pages (the top bar
// that has them on wider screens is hidden on phones)
export function MobileMenu({ items, storeName }: { items: MenuItem[]; storeName: string }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] gap-0 overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg">{storeName}</SheetTitle>
        </SheetHeader>
        <Accordion className="px-4">
          {items.map((item) => (
            <AccordionItem key={item.href} value={item.href}>
              <AccordionTrigger className="font-(family-name:--font-display) text-base font-semibold uppercase">{item.name}</AccordionTrigger>
              <AccordionContent>
                <ul className="flex flex-col pb-2">
                  <li>
                    <Link href={item.href} onClick={close} className="block rounded-md px-2 py-2 font-semibold hover:bg-accent">
                      Shop all {item.name}
                    </Link>
                  </li>
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link href={child.href} onClick={close} className="block rounded-md px-2 py-2 hover:bg-accent">
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <nav aria-label="Site" className="px-4 py-3">
          <ul className="flex flex-col">
            {siteLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={close} className="block rounded-md px-2 py-2 hover:bg-accent">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
