import { Metadata } from "next"
import AddStoreForm from "./_components/add-store-form"

export const metadata: Metadata = {
  title: "Add Store",
}

export default function AddStorePage() {
  return <AddStoreForm />
}
