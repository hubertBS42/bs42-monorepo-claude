// Seeds the starting catalogue: the category tree and brands carried over from the old BS42 app, without images.
// Safe to run again: a category that already exists under the same parent, or a brand with the same name, is skipped.
// Run with `pnpm --filter @workspace/db db:seed`.
import { prisma } from "../src/client"

type CategorySeed = {
  name: string
  description: string
  children?: CategorySeed[]
}

type BrandSeed = {
  name: string
  website: string | null
}

const categories: CategorySeed[] = [
  {
    name: "Security",
    description: "Security solutions including CCTV, access control, and alarms",
    children: [
      {
        name: "CCTV",
        description: "Closed-circuit television cameras and recording systems",
        children: [
          { name: "CCTV Cameras", description: "Surveillance cameras" },
          { name: "CCTV Recorders", description: "DVR and NVR recorders" },
          { name: "CCTV Accessories", description: "CCTV mounting brackets, power supplies, and accessories" },
          { name: "CCTV Installation Packages", description: "Complete CCTV installation kits" },
        ],
      },
      {
        name: "Access Control",
        description: "Access control systems and components",
        children: [
          { name: "Card Readers", description: "Access control card readers" },
          { name: "Electronic Locks", description: "Electronic and magnetic locks" },
          { name: "Exit Buttons", description: "Exit buttons and call points" },
          { name: "Intercoms", description: "Audio and video intercom systems" },
          { name: "Power Supplies", description: "Access control power supplies" },
          { name: "Accessories", description: "Access control accessories" },
        ],
      },
      {
        name: "Alarms",
        description: "Fire and intruder alarm systems",
        children: [
          { name: "Fire Alarms", description: "Fire alarm systems and detectors" },
          { name: "Intruder Alarms", description: "Burglar and intrusion alarm systems" },
        ],
      },
    ],
  },
  {
    name: "Networking",
    description: "Networking infrastructure and devices",
    children: [
      {
        name: "Infrastructure",
        description: "Networking infrastructure components",
        children: [
          { name: "Network Infrastructure", description: "Network infrastructure components" },
          { name: "Cable Management", description: "Cable management solutions" },
        ],
      },
      {
        name: "Networking Devices",
        description: "Active networking devices",
        children: [
          { name: "Network Switches", description: "Network switches and hubs" },
          { name: "Routers & Gateways", description: "Routers and network gateways" },
          { name: "Wireless Accessories", description: "Wireless aerials and accessories" },
          { name: "Network Cabinets", description: "Network equipment cabinets and racks" },
          { name: "Network Tools", description: "Network and electronic tools" },
        ],
      },
      {
        name: "Cables",
        description: "Various types of cables",
        children: [
          { name: "Network Cables", description: "Ethernet and network cables" },
          { name: "Audio & Video Cables", description: "Audio and video cables" },
          { name: "Power Cables", description: "Power and electrical cables" },
          { name: "Plugs & Connectors", description: "Network plugs and connectors" },
          { name: "Modules & Faceplates", description: "Network modules and faceplates" },
        ],
      },
    ],
  },
  {
    name: "Smart Homes",
    description: "Smart home automation devices and systems",
    children: [
      {
        name: "Smart Devices",
        description: "Smart home devices and accessories",
        children: [
          { name: "Smart Lights", description: "Smart lighting systems" },
          { name: "Smart Switches", description: "Smart light switches and dimmers" },
          { name: "Smart Plugs", description: "Smart plugs and sockets" },
          { name: "Smart Locks", description: "Smart door locks" },
          { name: "Smart Curtains", description: "Smart curtain and blind controllers" },
          { name: "Motion Sensors", description: "Motion and occupancy sensors" },
          { name: "LED Accessories", description: "LED strip controllers and accessories" },
        ],
      },
      {
        name: "Control Systems",
        description: "Smart home control panels and gateways",
        children: [
          { name: "Control Panels", description: "Smart home control panels" },
          { name: "Gateways & Hubs", description: "Smart home gateways and hubs" },
          { name: "Indoor Stations", description: "Indoor stations for intercoms" },
        ],
      },
    ],
  },
  {
    name: "Computing",
    description: "Computers and computing accessories",
    children: [
      {
        name: "Computers & Accessories",
        description: "Computers and computer accessories",
        children: [
          { name: "Data Storage", description: "External drives and storage devices" },
          { name: "USB Drives", description: "USB flash drives" },
          {
            name: "Printers",
            description: "Printers and printing accessories",
            children: [{ name: "Thermal Printers", description: "Thermal label and receipt printers" }],
          },
        ],
      },
    ],
  },
  {
    name: "Telephony",
    description: "Telephone and VoIP solutions",
    children: [
      {
        name: "VOIP",
        description: "Voice over IP phones and systems",
        children: [{ name: "IP Phones", description: "Cloud IP phones" }],
      },
    ],
  },
  {
    name: "Tools & Home Improvement",
    description: "Tools and home improvement products",
    children: [
      {
        name: "Electrical",
        description: "Electrical tools and equipment",
        children: [
          { name: "Solar Products", description: "Solar water heaters and solar products" },
          { name: "Water Pumps", description: "Water pumps and systems" },
          { name: "Speakers", description: "Audio speakers and sound systems" },
          { name: "Tools", description: "Electrical and general tools" },
        ],
      },
      {
        name: "Plumbing",
        description: "Plumbing tools and supplies",
        children: [{ name: "Plumbing Supplies", description: "Plumbing tools and supplies" }],
      },
      {
        name: "Home Improvement",
        description: "Home improvement products",
        children: [
          { name: "Floor & Wall", description: "Flooring and wall products" },
          { name: "Home Accessories", description: "Home accessories and decor" },
        ],
      },
    ],
  },
]

// Brands whose old record had no website, or used bs42.net as a stand-in, have none here
const brands: BrandSeed[] = [
  { name: "British General", website: "https://www.bgelectrical.uk/" },
  { name: "BS42.Net", website: "https://www.bs42.net" },
  { name: "Mikrotik", website: "https://mikrotik.com/" },
  { name: "Comfast", website: null },
  { name: "Fanvil", website: null },
  { name: "Ubiquiti", website: null },
  { name: "Tuya", website: "https://www.tuya.com/" },
  { name: "Cisco", website: null },
  { name: "Panasonic", website: null },
  { name: "Omada", website: null },
  { name: "Lanbon", website: "https://www.lanbon.cn/" },
  { name: "Yealink", website: "https://www.yealink.com/" },
  { name: "GZCOM", website: "https://www.gzcomm.com/" },
  { name: "SIEMENS", website: "https://www.siemens.com/" },
  { name: "ZISA", website: "https://www.zisacom.com" },
  { name: "Mestek", website: "http://www.mestek-tools.com/" },
  { name: "Ifan", website: null },
  { name: "Satlink", website: null },
  { name: "D'Locks", website: null },
  { name: "TT Lock", website: null },
]

const counts = { created: 0, skipped: 0 }

async function seedCategories(nodes: CategorySeed[], parentId: string | null) {
  for (const { children, ...data } of nodes) {
    let category = await prisma.category.findFirst({ where: { parentId, name: data.name }, select: { id: true } })
    if (category) {
      counts.skipped++
    } else {
      // Placeholder: the Prisma hook generates the real slug from the name
      category = await prisma.category.create({ data: { ...data, slug: "", parentId, status: "PUBLISHED" }, select: { id: true } })
      counts.created++
    }
    if (children) await seedCategories(children, category.id)
  }
}

async function seedBrands() {
  for (const data of brands) {
    if (await prisma.brand.findUnique({ where: { name: data.name }, select: { id: true } })) {
      counts.skipped++
      continue
    }
    await prisma.brand.create({ data: { ...data, slug: "", status: "PUBLISHED" } })
    counts.created++
  }
}

async function main() {
  await seedCategories(categories, null)
  console.log(`Categories: ${counts.created} created, ${counts.skipped} already there`)

  counts.created = 0
  counts.skipped = 0
  await seedBrands()
  console.log(`Brands: ${counts.created} created, ${counts.skipped} already there`)
}

try {
  await main()
} catch (error) {
  console.error("Seeding failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
