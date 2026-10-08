import type { Metadata } from "next"

import { FormComponentsDemo } from "./_components/form-components-demo"

export const metadata: Metadata = {
  title: "Form components",
}

export default function FormComponentsPage() {
  return <FormComponentsDemo />
}
