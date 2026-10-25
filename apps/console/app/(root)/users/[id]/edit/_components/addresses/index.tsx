import { MapPin } from "lucide-react"
import type { Address } from "@workspace/db/client"
import AddressCard from "./address-card"
import { EmptyState } from "@workspace/ui/components/empty-state"

const Addresses = ({ addresses }: { addresses: Address[] }) => {
  return (
    <div>
      {addresses.length > 0 ? (
        <div className="grid gap-3">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <EmptyState icon={MapPin} title="No saved addresses" description="Addresses the customer saves, or you add, show here." />
      )}
    </div>
  )
}
export default Addresses
