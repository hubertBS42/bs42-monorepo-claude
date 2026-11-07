import { Link, Section, Text } from "react-email"

export interface PickupLocation {
  address: string
  hours: string | null
  mapUrl: string | null
}

// Where to collect a pickup order, from Settings' contact details
export const PickupDetails = ({ location }: { location: PickupLocation }) => (
  <Section className="mt-6 rounded-md bg-gray-50 p-4">
    <Text className="m-0 font-semibold text-[#71717a]">Where to collect it</Text>
    <Text className="m-0 text-sm text-gray-500">{location.address}</Text>
    {location.hours && <Text className="m-0 text-sm text-gray-500">{location.hours}</Text>}
    {location.mapUrl && (
      <Text className="m-0 text-sm text-gray-500">
        <Link href={location.mapUrl}>Get directions</Link>
      </Text>
    )}
  </Section>
)
