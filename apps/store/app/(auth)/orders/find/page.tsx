import type { Metadata } from "next"

import { FindOrderForm } from "@/components/account/find-order-form"

export const metadata: Metadata = { title: "Find your order", robots: { index: false } }

export default function FindOrderPage() {
  return <FindOrderForm />
}
