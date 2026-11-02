"use client"

import { Bell, KeyRound, Monitor, User } from "lucide-react"
import SectionNav, { type Section } from "@/components/section-nav"

const SECTIONS: Section[] = [
  { href: "/account/profile", title: "Profile", icon: User },
  { href: "/account/password", title: "Password", icon: KeyRound },
  { href: "/account/sessions", title: "Sessions", icon: Monitor },
  { href: "/account/notifications", title: "Notifications", icon: Bell },
]

export default function AccountNav() {
  return <SectionNav label="Account" sections={SECTIONS} />
}
