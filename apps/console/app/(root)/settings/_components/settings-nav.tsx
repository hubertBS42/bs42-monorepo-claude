"use client"

import { Bell, Coins, Scale, SlidersHorizontal, Truck } from "lucide-react"
import SectionNav, { type Section } from "@/components/section-nav"

const SECTIONS: Section[] = [
  { href: "/settings", title: "General", icon: SlidersHorizontal },
  { href: "/settings/pricing", title: "Pricing", icon: Coins },
  { href: "/settings/delivery", title: "Delivery", icon: Truck },
  { href: "/settings/notifications", title: "Notifications", icon: Bell },
  { href: "/settings/legal", title: "Legal", icon: Scale },
]

export default function SettingsNav() {
  return <SectionNav label="Settings" sections={SECTIONS} />
}
