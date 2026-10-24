import type { Metadata } from "next"
import DeliveryCard from "../_components/delivery-card"
import InstallationCard from "../_components/installation-card"
import SettingsSection from "../_components/settings-section"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { getInstallationAreas } from "@/lib/data/installation.data"

export const metadata: Metadata = {
  title: "Delivery Settings",
}

export default async function DeliverySettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [delivery, installation] = await Promise.all([getDeliverySettings(), getInstallationAreas()])

  return (
    <SettingsSection title="Delivery" description="Delivery fees and installation areas.">
      <DeliveryCard settings={delivery} />
      <InstallationCard settings={installation} />
    </SettingsSection>
  )
}
