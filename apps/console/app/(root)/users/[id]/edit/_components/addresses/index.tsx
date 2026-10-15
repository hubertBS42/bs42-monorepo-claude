import type { Address } from "@workspace/db/client"
import AddressCard from "./address-card"

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
        <span className="flex justify-center text-sm">No saved addresses</span>
      )}
    </div>
  )
}
export default Addresses
