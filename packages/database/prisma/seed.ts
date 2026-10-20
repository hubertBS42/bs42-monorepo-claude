// Seeds the starting catalogue: the category tree and brands carried over from the old BS42 app, sample products without
// images, and specifications for some categories with the sample products' values.
// Safe to run again: a category that already exists under the same parent, a brand or product with the same name, a
// spec its category already has, or a value a product already has is skipped.
// Run with `pnpm --filter @workspace/db db:seed`.
//
// `db:seed:demo` (`--demo`) also adds a demo store to browse and order from: listings for most published products, with
// a mix of stock levels, sale prices and a few listings hidden from customers, and today's exchange rate if there's none.
// It's for development databases only: the rate is made up.
import { generateUniqueSku, prisma } from "../src/client"
import { Prisma } from "../generated/prisma/client"

type CategorySeed = {
  name: string
  description: string
  children?: CategorySeed[]
}

type BrandSeed = {
  name: string
  website: string | null
}

// Prices are USD, as strings so they reach the Decimal columns exactly. `category` is a leaf category's name.
// A product with `options` gets a variant for every combination of their values.
type ProductSeed = {
  name: string
  brand: string
  category: string
  sell: string
  buy: string
  description: string
  weight?: string
  dimensions?: string
  tags?: string[]
  options?: { name: string; values: string[] }[]
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
  // Added for the sample products
  { name: "Hikvision", website: "https://www.hikvision.com/" },
  { name: "Dahua", website: "https://www.dahuasecurity.com/" },
  { name: "SanDisk", website: "https://www.sandisk.com/" },
  { name: "Seagate", website: "https://www.seagate.com/" },
  { name: "Xprinter", website: null },
]

const products: ProductSeed[] = [
  // CCTV
  {
    name: "Hikvision 2MP Dome Camera",
    brand: "Hikvision",
    category: "CCTV Cameras",
    sell: "28.00",
    buy: "19.50",
    description: "1080p indoor dome camera with 20 m infrared night vision and a 2.8 mm fixed lens.",
    weight: "0.35",
    dimensions: "11x11x9 cm",
    tags: ["dome", "1080p", "indoor"],
  },
  {
    name: "Hikvision 4MP Bullet Camera",
    brand: "Hikvision",
    category: "CCTV Cameras",
    sell: "42.00",
    buy: "30.00",
    description: "Weatherproof IP67 bullet camera with 30 m EXIR night vision for outdoor use.",
    weight: "0.55",
    dimensions: "18x8x8 cm",
    tags: ["bullet", "outdoor", "4mp"],
    options: [{ name: "Lens", values: ["2.8 mm", "4 mm", "6 mm"] }],
  },
  {
    name: "Hikvision ColorVu Turret Camera",
    brand: "Hikvision",
    category: "CCTV Cameras",
    sell: "55.00",
    buy: "39.00",
    description: "Full-colour images around the clock, with a warm supplemental light and a built-in microphone.",
    weight: "0.45",
    dimensions: "12x12x10 cm",
    tags: ["colorvu", "turret"],
    options: [{ name: "Resolution", values: ["2MP", "4MP"] }],
  },
  {
    name: "Dahua 2MP HDCVI Bullet Camera",
    brand: "Dahua",
    category: "CCTV Cameras",
    sell: "24.00",
    buy: "16.80",
    description: "Analogue HD bullet camera that works with existing coaxial cabling.",
    weight: "0.40",
    dimensions: "17x7x7 cm",
    tags: ["hdcvi", "bullet", "analogue"],
  },
  {
    name: "Dahua 4MP PTZ Camera",
    brand: "Dahua",
    category: "CCTV Cameras",
    sell: "310.00",
    buy: "238.00",
    description: "Pan, tilt and 25x optical zoom IP camera with auto-tracking and 100 m infrared.",
    weight: "3.20",
    dimensions: "30x22x22 cm",
    tags: ["ptz", "zoom", "ip"],
  },
  {
    name: "Dahua Wi-Fi Cube Camera",
    brand: "Dahua",
    category: "CCTV Cameras",
    sell: "35.00",
    buy: "24.00",
    description: "Compact Wi-Fi camera with two-way audio, motion alerts and microSD recording.",
    weight: "0.20",
    dimensions: "8x8x11 cm",
    tags: ["wifi", "indoor", "two-way audio"],
    options: [{ name: "Colour", values: ["White", "Black"] }],
  },
  {
    name: "Hikvision 8-Channel NVR",
    brand: "Hikvision",
    category: "CCTV Recorders",
    sell: "120.00",
    buy: "88.00",
    description: "Network video recorder for up to 8 IP cameras, with 8 PoE ports and 4K output.",
    weight: "1.60",
    dimensions: "32x24x5 cm",
    tags: ["nvr", "poe"],
    options: [{ name: "Channels", values: ["4", "8", "16"] }],
  },
  {
    name: "Dahua 16-Channel XVR",
    brand: "Dahua",
    category: "CCTV Recorders",
    sell: "145.00",
    buy: "104.00",
    description: "Hybrid recorder for HDCVI, AHD, TVI, CVBS and IP cameras, with two SATA bays.",
    weight: "2.10",
    dimensions: "37x28x5 cm",
    tags: ["xvr", "hybrid"],
  },
  {
    name: "Hikvision 4-Channel DVR",
    brand: "Hikvision",
    category: "CCTV Recorders",
    sell: "58.00",
    buy: "41.00",
    description: "Turbo HD digital video recorder for up to four analogue cameras.",
    weight: "0.90",
    dimensions: "26x22x4 cm",
    tags: ["dvr", "turbo hd"],
  },
  {
    name: "Camera Junction Box",
    brand: "BS42.Net",
    category: "CCTV Accessories",
    sell: "6.50",
    buy: "3.20",
    description: "Weatherproof junction box that hides a camera's cable connections.",
    weight: "0.25",
    dimensions: "14x14x5 cm",
    tags: ["junction box", "mounting"],
  },
  {
    name: "12V 2A CCTV Power Adapter",
    brand: "BS42.Net",
    category: "CCTV Accessories",
    sell: "4.00",
    buy: "1.80",
    description: "Regulated 12 V DC power adapter for a single camera.",
    weight: "0.12",
    tags: ["power", "12v"],
  },
  {
    name: "BNC Connector Pack",
    brand: "BS42.Net",
    category: "CCTV Accessories",
    sell: "5.00",
    buy: "2.10",
    description: "Pack of 10 twist-on BNC connectors for RG59 coaxial cable.",
    weight: "0.10",
    tags: ["bnc", "coax"],
  },
  {
    name: "Wall Mount Bracket",
    brand: "Hikvision",
    category: "CCTV Accessories",
    sell: "9.00",
    buy: "5.40",
    description: "Aluminium wall mount for dome and turret cameras.",
    weight: "0.30",
    tags: ["bracket", "mounting"],
    options: [{ name: "Colour", values: ["White", "Black"] }],
  },
  {
    name: "4-Camera CCTV Kit",
    brand: "Hikvision",
    category: "CCTV Installation Packages",
    sell: "260.00",
    buy: "190.00",
    description: "Four 2MP cameras, a 4-channel recorder, a 1 TB drive, cabling and power, ready to install.",
    weight: "5.50",
    dimensions: "45x35x25 cm",
    tags: ["kit", "package"],
    options: [{ name: "Storage", values: ["1 TB", "2 TB"] }],
  },
  {
    name: "8-Camera IP CCTV Kit",
    brand: "Dahua",
    category: "CCTV Installation Packages",
    sell: "520.00",
    buy: "385.00",
    description: "Eight 4MP IP cameras with a PoE recorder and a 2 TB drive.",
    weight: "9.80",
    dimensions: "60x40x30 cm",
    tags: ["kit", "ip", "poe"],
  },

  // Access control
  {
    name: "ZISA RFID Card Reader",
    brand: "ZISA",
    category: "Card Readers",
    sell: "32.00",
    buy: "21.00",
    description: "125 kHz proximity card reader with Wiegand output and a keypad.",
    weight: "0.25",
    dimensions: "12x8x2 cm",
    tags: ["rfid", "wiegand", "keypad"],
  },
  {
    name: "ZISA Fingerprint Access Terminal",
    brand: "ZISA",
    category: "Card Readers",
    sell: "95.00",
    buy: "68.00",
    description: "Standalone terminal for up to 3,000 fingerprints and 10,000 cards, with time attendance.",
    weight: "0.60",
    dimensions: "18x8x4 cm",
    tags: ["fingerprint", "attendance"],
  },
  {
    name: "Proximity Cards",
    brand: "ZISA",
    category: "Card Readers",
    sell: "8.00",
    buy: "4.50",
    description: "Pack of 10 125 kHz proximity cards.",
    weight: "0.10",
    tags: ["cards", "rfid"],
    options: [{ name: "Type", values: ["Card", "Key fob"] }],
  },
  {
    name: "600lb Magnetic Lock",
    brand: "ZISA",
    category: "Electronic Locks",
    sell: "38.00",
    buy: "26.00",
    description: "Electromagnetic lock with 280 kg holding force for single doors.",
    weight: "2.00",
    dimensions: "25x5x3 cm",
    tags: ["maglock", "fail-safe"],
  },
  {
    name: "Electric Drop Bolt",
    brand: "ZISA",
    category: "Electronic Locks",
    sell: "45.00",
    buy: "31.00",
    description: "Fail-safe drop bolt for glass and frameless doors.",
    weight: "0.90",
    tags: ["drop bolt", "glass door"],
  },
  {
    name: "Electric Strike Lock",
    brand: "ZISA",
    category: "Electronic Locks",
    sell: "29.00",
    buy: "19.00",
    description: "Fail-secure electric strike for wooden and metal door frames.",
    weight: "0.45",
    tags: ["strike"],
  },
  {
    name: "Stainless Steel Exit Button",
    brand: "ZISA",
    category: "Exit Buttons",
    sell: "7.50",
    buy: "3.80",
    description: "Push-to-exit button with a stainless steel faceplate.",
    weight: "0.15",
    tags: ["exit button"],
    options: [{ name: "Size", values: ["Standard", "Narrow"] }],
  },
  {
    name: "Touchless Exit Sensor",
    brand: "ZISA",
    category: "Exit Buttons",
    sell: "14.00",
    buy: "8.50",
    description: "Infrared no-touch exit sensor with an LED indicator.",
    weight: "0.15",
    tags: ["touchless", "exit button"],
  },
  {
    name: "Emergency Break Glass Call Point",
    brand: "ZISA",
    category: "Exit Buttons",
    sell: "11.00",
    buy: "6.20",
    description: "Resettable green call point that releases a door in an emergency.",
    weight: "0.20",
    tags: ["emergency", "call point"],
  },
  {
    name: "Hikvision Video Intercom Kit",
    brand: "Hikvision",
    category: "Intercoms",
    sell: "185.00",
    buy: "135.00",
    description: "Door station and 7-inch indoor monitor with app unlocking.",
    weight: "1.80",
    dimensions: "30x25x12 cm",
    tags: ["video intercom", "kit"],
  },
  {
    name: "Dahua Villa Door Station",
    brand: "Dahua",
    category: "Intercoms",
    sell: "98.00",
    buy: "70.00",
    description: "IP door station with a 2MP camera, card reader and a call button.",
    weight: "0.50",
    tags: ["door station", "ip"],
  },
  {
    name: "12V 5A Access Control Power Supply",
    brand: "ZISA",
    category: "Power Supplies",
    sell: "26.00",
    buy: "17.00",
    description: "Boxed power supply with a battery backup connection and timer.",
    weight: "1.20",
    dimensions: "22x18x7 cm",
    tags: ["power supply", "battery backup"],
  },
  { name: "Door Closer", brand: "ZISA", category: "Accessories", sell: "18.00", buy: "11.50", description: "Hydraulic door closer for doors up to 65 kg.", weight: "1.10", tags: ["door closer"] },
  {
    name: "Magnetic Lock Bracket",
    brand: "ZISA",
    category: "Accessories",
    sell: "12.00",
    buy: "7.00",
    description: "L and Z bracket set for mounting a magnetic lock on inward-opening doors.",
    weight: "0.70",
    tags: ["bracket", "maglock"],
  },

  // Alarms
  {
    name: "Optical Smoke Detector",
    brand: "SIEMENS",
    category: "Fire Alarms",
    sell: "22.00",
    buy: "14.50",
    description: "Conventional photoelectric smoke detector with an LED indicator.",
    weight: "0.15",
    tags: ["smoke", "detector"],
  },
  {
    name: "Heat Detector",
    brand: "SIEMENS",
    category: "Fire Alarms",
    sell: "19.00",
    buy: "12.40",
    description: "Fixed-temperature and rate-of-rise heat detector for kitchens and garages.",
    weight: "0.15",
    tags: ["heat", "detector"],
  },
  {
    name: "4-Zone Fire Alarm Panel",
    brand: "SIEMENS",
    category: "Fire Alarms",
    sell: "240.00",
    buy: "175.00",
    description: "Conventional control panel for four detection zones, with battery backup.",
    weight: "4.50",
    dimensions: "35x30x9 cm",
    tags: ["panel", "conventional"],
    options: [{ name: "Zones", values: ["2", "4", "8"] }],
  },
  {
    name: "Fire Alarm Sounder",
    brand: "SIEMENS",
    category: "Fire Alarms",
    sell: "16.00",
    buy: "9.80",
    description: "Wall-mounted sounder with a red flashing beacon.",
    weight: "0.25",
    tags: ["sounder", "beacon"],
    options: [{ name: "Colour", values: ["Red", "White"] }],
  },
  {
    name: "Wireless Intruder Alarm Kit",
    brand: "Tuya",
    category: "Intruder Alarms",
    sell: "89.00",
    buy: "62.00",
    description: "Wi-Fi alarm hub with two door sensors, a motion sensor, a siren and remote fobs.",
    weight: "1.30",
    dimensions: "28x20x8 cm",
    tags: ["alarm kit", "wifi"],
  },
  {
    name: "Outdoor Alarm Siren",
    brand: "BS42.Net",
    category: "Intruder Alarms",
    sell: "21.00",
    buy: "13.00",
    description: "120 dB weatherproof siren with a strobe.",
    weight: "0.60",
    tags: ["siren", "outdoor"],
  },

  // Networking infrastructure
  {
    name: "24-Port Cat6 Patch Panel",
    brand: "BS42.Net",
    category: "Network Infrastructure",
    sell: "35.00",
    buy: "22.00",
    description: "1U rack-mount patch panel with punch-down keystones.",
    weight: "1.10",
    dimensions: "48x10x4 cm",
    tags: ["patch panel", "cat6"],
    options: [{ name: "Ports", values: ["24", "48"] }],
  },
  {
    name: "Rack Mount PDU",
    brand: "BS42.Net",
    category: "Network Infrastructure",
    sell: "28.00",
    buy: "18.00",
    description: "1U power distribution unit with eight UK sockets and a surge protector.",
    weight: "1.20",
    tags: ["pdu", "rack"],
  },
  {
    name: "Cable Ties",
    brand: "BS42.Net",
    category: "Cable Management",
    sell: "3.00",
    buy: "1.10",
    description: "Bag of 100 nylon cable ties.",
    weight: "0.10",
    tags: ["cable ties"],
    options: [
      { name: "Length", values: ["150 mm", "200 mm", "300 mm"] },
      { name: "Colour", values: ["Black", "White"] },
    ],
  },
  {
    name: "1U Cable Management Bar",
    brand: "BS42.Net",
    category: "Cable Management",
    sell: "12.00",
    buy: "7.00",
    description: "Rack-mount bar with five plastic rings for tidy patch cables.",
    weight: "0.60",
    tags: ["rack", "cable management"],
  },
  {
    name: "PVC Trunking",
    brand: "BS42.Net",
    category: "Cable Management",
    sell: "4.50",
    buy: "2.00",
    description: "Self-adhesive cable trunking, 2 m length.",
    weight: "0.40",
    tags: ["trunking"],
    options: [{ name: "Size", values: ["16x16 mm", "25x16 mm", "40x25 mm"] }],
  },

  // Networking devices
  {
    name: "Mikrotik CRS326 Switch",
    brand: "Mikrotik",
    category: "Network Switches",
    sell: "195.00",
    buy: "150.00",
    description: "24 gigabit ports and two SFP+ ports, managed with RouterOS or SwOS.",
    weight: "1.70",
    dimensions: "44x14x4 cm",
    tags: ["managed", "sfp+"],
  },
  {
    name: "Omada 8-Port PoE Switch",
    brand: "Omada",
    category: "Network Switches",
    sell: "78.00",
    buy: "56.00",
    description: "Easy smart gigabit switch with four PoE+ ports, managed from Omada.",
    weight: "0.80",
    tags: ["poe", "smart switch"],
    options: [{ name: "Ports", values: ["8", "16", "24"] }],
  },
  {
    name: "Cisco CBS250 24-Port Switch",
    brand: "Cisco",
    category: "Network Switches",
    sell: "385.00",
    buy: "298.00",
    description: "Business smart switch with 24 gigabit ports and 4 SFP uplinks.",
    weight: "3.00",
    tags: ["managed", "business"],
  },
  {
    name: "Ubiquiti UniFi Flex Mini",
    brand: "Ubiquiti",
    category: "Network Switches",
    sell: "35.00",
    buy: "26.00",
    description: "Compact five-port managed gigabit switch, powered by PoE or USB-C.",
    weight: "0.15",
    tags: ["unifi", "mini"],
  },
  {
    name: "Mikrotik hAP ax2",
    brand: "Mikrotik",
    category: "Routers & Gateways",
    sell: "95.00",
    buy: "72.00",
    description: "Dual-band Wi-Fi 6 home access point with five gigabit ports.",
    weight: "0.50",
    tags: ["wifi 6", "router"],
  },
  {
    name: "Mikrotik RB5009",
    brand: "Mikrotik",
    category: "Routers & Gateways",
    sell: "230.00",
    buy: "178.00",
    description: "Rack-mountable router with a 2.5 G port, a 10 G SFP+ cage and seven gigabit ports.",
    weight: "0.90",
    tags: ["router", "sfp+"],
  },
  {
    name: "Omada ER605 VPN Router",
    brand: "Omada",
    category: "Routers & Gateways",
    sell: "72.00",
    buy: "52.00",
    description: "Multi-WAN gigabit VPN router with load balancing.",
    weight: "0.60",
    tags: ["vpn", "multi-wan"],
  },
  {
    name: "Ubiquiti UniFi U6 Lite",
    brand: "Ubiquiti",
    category: "Wireless Accessories",
    sell: "115.00",
    buy: "88.00",
    description: "Ceiling-mount Wi-Fi 6 access point powered by PoE.",
    weight: "0.30",
    tags: ["access point", "wifi 6"],
  },
  {
    name: "Comfast Outdoor CPE",
    brand: "Comfast",
    category: "Wireless Accessories",
    sell: "48.00",
    buy: "33.00",
    description: "5 GHz point-to-point bridge with a 3 km range.",
    weight: "0.70",
    tags: ["cpe", "bridge", "outdoor"],
    options: [{ name: "Pack", values: ["Single", "Pair"] }],
  },
  {
    name: "Comfast USB Wi-Fi Adapter",
    brand: "Comfast",
    category: "Wireless Accessories",
    sell: "12.00",
    buy: "7.20",
    description: "Dual-band USB adapter for desktops and laptops.",
    weight: "0.05",
    tags: ["usb", "adapter"],
  },
  {
    name: "Omni Antenna",
    brand: "Comfast",
    category: "Wireless Accessories",
    sell: "15.00",
    buy: "9.00",
    description: "Dual-band omnidirectional antenna with an RP-SMA connector.",
    weight: "0.10",
    tags: ["antenna"],
    options: [{ name: "Gain", values: ["5 dBi", "8 dBi"] }],
  },
  {
    name: "Wall Mount Network Cabinet",
    brand: "BS42.Net",
    category: "Network Cabinets",
    sell: "95.00",
    buy: "64.00",
    description: "Lockable wall-mount cabinet with a glass door and a fan.",
    weight: "14.00",
    tags: ["cabinet", "wall mount"],
    options: [{ name: "Size", values: ["6U", "9U", "12U"] }],
  },
  {
    name: "42U Floor Standing Rack",
    brand: "BS42.Net",
    category: "Network Cabinets",
    sell: "620.00",
    buy: "455.00",
    description: "800 mm deep server rack with perforated doors and adjustable feet.",
    weight: "85.00",
    dimensions: "200x60x80 cm",
    tags: ["rack", "server"],
  },
  {
    name: "Mestek Crimping Tool",
    brand: "Mestek",
    category: "Network Tools",
    sell: "14.00",
    buy: "8.00",
    description: "Ratchet crimper for RJ45, RJ12 and RJ11 plugs, with a cable stripper.",
    weight: "0.40",
    tags: ["crimper", "rj45"],
  },
  {
    name: "Mestek Network Cable Tester",
    brand: "Mestek",
    category: "Network Tools",
    sell: "18.00",
    buy: "10.50",
    description: "Tests RJ45 and RJ11 cables for continuity and wiring faults.",
    weight: "0.25",
    tags: ["tester"],
  },
  {
    name: "Punch Down Tool",
    brand: "Mestek",
    category: "Network Tools",
    sell: "9.00",
    buy: "5.00",
    description: "Impact punch-down tool for 110 and Krone blocks.",
    weight: "0.15",
    tags: ["punch down"],
  },

  // Cables
  {
    name: "Cat6 UTP Cable Box",
    brand: "BS42.Net",
    category: "Network Cables",
    sell: "95.00",
    buy: "65.00",
    description: "305 m box of solid copper Cat6 cable.",
    weight: "11.00",
    tags: ["cat6", "box"],
    options: [{ name: "Colour", values: ["Grey", "Blue", "White"] }],
  },
  {
    name: "Cat6 Patch Cable",
    brand: "BS42.Net",
    category: "Network Cables",
    sell: "3.50",
    buy: "1.60",
    description: "Moulded Cat6 patch cable with snagless boots.",
    weight: "0.10",
    tags: ["patch cable", "cat6"],
    options: [{ name: "Length", values: ["1 m", "2 m", "5 m", "10 m"] }],
  },
  {
    name: "Outdoor Cat6 FTP Cable",
    brand: "BS42.Net",
    category: "Network Cables",
    sell: "135.00",
    buy: "96.00",
    description: "305 m of shielded, UV-resistant Cat6 for outdoor runs.",
    weight: "14.00",
    tags: ["outdoor", "shielded"],
  },
  {
    name: "HDMI Cable",
    brand: "BS42.Net",
    category: "Audio & Video Cables",
    sell: "6.00",
    buy: "2.80",
    description: "High-speed HDMI 2.0 cable with gold-plated connectors, 4K at 60 Hz.",
    weight: "0.15",
    tags: ["hdmi", "4k"],
    options: [{ name: "Length", values: ["1.5 m", "3 m", "5 m", "10 m"] }],
  },
  {
    name: "RG59 Coaxial Cable with Power",
    brand: "BS42.Net",
    category: "Audio & Video Cables",
    sell: "38.00",
    buy: "25.00",
    description: "100 m roll of RG59 coax with a twin power core for CCTV.",
    weight: "6.00",
    tags: ["rg59", "coax", "cctv"],
  },
  {
    name: "Speaker Cable",
    brand: "BS42.Net",
    category: "Audio & Video Cables",
    sell: "22.00",
    buy: "14.00",
    description: "100 m roll of 2-core oxygen-free copper speaker cable.",
    weight: "3.50",
    tags: ["speaker cable"],
  },
  {
    name: "British General 2.5mm Twin and Earth Cable",
    brand: "British General",
    category: "Power Cables",
    sell: "68.00",
    buy: "49.00",
    description: "100 m drum of 2.5 mm² twin and earth cable for ring mains.",
    weight: "12.00",
    tags: ["twin and earth"],
  },
  {
    name: "IEC Power Cable",
    brand: "BS42.Net",
    category: "Power Cables",
    sell: "3.00",
    buy: "1.30",
    description: "1.8 m UK plug to C13 power cable for computers and monitors.",
    weight: "0.20",
    tags: ["iec", "c13"],
  },
  {
    name: "RJ45 Cat6 Connectors",
    brand: "BS42.Net",
    category: "Plugs & Connectors",
    sell: "6.00",
    buy: "2.90",
    description: "Pack of 100 RJ45 plugs for Cat6 cable.",
    weight: "0.20",
    tags: ["rj45"],
    options: [{ name: "Type", values: ["Standard", "Pass-through"] }],
  },
  {
    name: "RJ45 Boots",
    brand: "BS42.Net",
    category: "Plugs & Connectors",
    sell: "3.00",
    buy: "1.20",
    description: "Pack of 100 strain-relief boots.",
    weight: "0.10",
    tags: ["boots"],
    options: [{ name: "Colour", values: ["Blue", "Grey", "Red", "Yellow"] }],
  },
  {
    name: "Cat6 Keystone Jack",
    brand: "British General",
    category: "Modules & Faceplates",
    sell: "3.20",
    buy: "1.70",
    description: "Tool-less Cat6 keystone module.",
    weight: "0.03",
    tags: ["keystone", "cat6"],
  },
  {
    name: "British General Double Data Faceplate",
    brand: "British General",
    category: "Modules & Faceplates",
    sell: "4.50",
    buy: "2.30",
    description: "White moulded faceplate for two keystone modules.",
    weight: "0.08",
    tags: ["faceplate"],
    options: [{ name: "Ports", values: ["Single", "Double"] }],
  },
  {
    name: "Euro Module Data Outlet",
    brand: "British General",
    category: "Modules & Faceplates",
    sell: "5.50",
    buy: "3.00",
    description: "Euro module RJ45 outlet with a shutter.",
    weight: "0.05",
    tags: ["euro module"],
  },

  // Smart home
  {
    name: "Tuya Smart LED Bulb",
    brand: "Tuya",
    category: "Smart Lights",
    sell: "9.00",
    buy: "5.20",
    description: "9 W Wi-Fi bulb with 16 million colours and tunable white, controlled from the Smart Life app.",
    weight: "0.07",
    tags: ["bulb", "wifi", "rgb"],
    options: [{ name: "Fitting", values: ["E27", "B22"] }],
  },
  {
    name: "Tuya Smart Downlight",
    brand: "Tuya",
    category: "Smart Lights",
    sell: "14.00",
    buy: "8.50",
    description: "Recessed RGB and white downlight with voice control.",
    weight: "0.20",
    tags: ["downlight"],
  },
  {
    name: "Lanbon Smart Touch Switch",
    brand: "Lanbon",
    category: "Smart Switches",
    sell: "28.00",
    buy: "18.00",
    description: "Glass touch switch for Wi-Fi and Zigbee, with no neutral wire needed.",
    weight: "0.20",
    dimensions: "8.6x8.6x3 cm",
    tags: ["touch switch", "glass"],
    options: [
      { name: "Gangs", values: ["1 gang", "2 gang", "3 gang"] },
      { name: "Colour", values: ["White", "Black"] },
    ],
  },
  {
    name: "Ifan Smart Dimmer Switch",
    brand: "Ifan",
    category: "Smart Switches",
    sell: "24.00",
    buy: "15.50",
    description: "Wi-Fi rotary dimmer for LED and halogen lights.",
    weight: "0.15",
    tags: ["dimmer"],
  },
  {
    name: "Tuya Smart Plug",
    brand: "Tuya",
    category: "Smart Plugs",
    sell: "11.00",
    buy: "6.50",
    description: "13 A UK smart plug with energy monitoring and schedules.",
    weight: "0.10",
    tags: ["plug", "energy monitoring"],
    options: [{ name: "Pack", values: ["Single", "4-pack"] }],
  },
  {
    name: "Tuya Smart Power Strip",
    brand: "Tuya",
    category: "Smart Plugs",
    sell: "26.00",
    buy: "17.00",
    description: "Four individually controlled sockets and three USB ports.",
    weight: "0.50",
    tags: ["power strip"],
  },
  {
    name: "Lanbon Smart Wall Socket",
    brand: "Lanbon",
    category: "Smart Plugs",
    sell: "22.00",
    buy: "14.00",
    description: "Double wall socket with app control and USB charging.",
    weight: "0.25",
    tags: ["socket"],
  },
  {
    name: "TT Lock Smart Door Lock",
    brand: "TT Lock",
    category: "Smart Locks",
    sell: "145.00",
    buy: "102.00",
    description: "Fingerprint, code, card and app unlocking with a mechanical key backup.",
    weight: "3.20",
    dimensions: "40x15x10 cm",
    tags: ["fingerprint", "app"],
    options: [{ name: "Finish", values: ["Black", "Silver"] }],
  },
  {
    name: "D'Locks Smart Padlock",
    brand: "D'Locks",
    category: "Smart Locks",
    sell: "38.00",
    buy: "25.00",
    description: "Bluetooth fingerprint padlock with USB charging.",
    weight: "0.25",
    tags: ["padlock", "bluetooth"],
  },
  {
    name: "D'Locks Glass Door Smart Lock",
    brand: "D'Locks",
    category: "Smart Locks",
    sell: "120.00",
    buy: "84.00",
    description: "No-drill smart lock for frameless glass doors.",
    weight: "1.80",
    tags: ["glass door"],
  },
  {
    name: "Tuya Smart Curtain Motor",
    brand: "Tuya",
    category: "Smart Curtains",
    sell: "85.00",
    buy: "60.00",
    description: "Quiet curtain motor with app control and schedules. Track sold separately.",
    weight: "1.40",
    tags: ["curtain", "motor"],
  },
  {
    name: "Motorised Curtain Track",
    brand: "Tuya",
    category: "Smart Curtains",
    sell: "45.00",
    buy: "29.00",
    description: "Aluminium curtain track for the Tuya curtain motor.",
    weight: "2.50",
    tags: ["track"],
    options: [{ name: "Length", values: ["2 m", "3 m", "4 m"] }],
  },
  {
    name: "Tuya PIR Motion Sensor",
    brand: "Tuya",
    category: "Motion Sensors",
    sell: "12.00",
    buy: "7.00",
    description: "Battery-powered Zigbee motion sensor for automations and alarms.",
    weight: "0.05",
    tags: ["pir", "zigbee"],
  },
  {
    name: "Ceiling Presence Sensor",
    brand: "Tuya",
    category: "Motion Sensors",
    sell: "29.00",
    buy: "19.50",
    description: "mmWave presence sensor that detects people sitting still.",
    weight: "0.10",
    tags: ["mmwave", "presence"],
  },
  {
    name: "LED Strip Controller",
    brand: "Tuya",
    category: "LED Accessories",
    sell: "13.00",
    buy: "7.50",
    description: "Wi-Fi controller for 12 V and 24 V LED strips.",
    weight: "0.08",
    tags: ["led", "controller"],
    options: [{ name: "Type", values: ["RGB", "RGBW", "RGBCCT"] }],
  },
  {
    name: "LED Strip Light 5m",
    brand: "BS42.Net",
    category: "LED Accessories",
    sell: "16.00",
    buy: "9.00",
    description: "5 m flexible LED strip with an adhesive backing.",
    weight: "0.30",
    tags: ["led strip"],
    options: [{ name: "Colour", values: ["Warm white", "Cool white", "RGB"] }],
  },
  {
    name: "Lanbon 4-inch Smart Control Panel",
    brand: "Lanbon",
    category: "Control Panels",
    sell: "120.00",
    buy: "86.00",
    description: "Wall-mounted touchscreen that controls lights, curtains and scenes.",
    weight: "0.30",
    tags: ["touchscreen", "scenes"],
  },
  {
    name: "Tuya 10-inch Smart Home Panel",
    brand: "Tuya",
    category: "Control Panels",
    sell: "210.00",
    buy: "152.00",
    description: "In-wall Android panel with a built-in Zigbee gateway and intercom.",
    weight: "0.90",
    tags: ["panel", "zigbee"],
  },
  {
    name: "Tuya Zigbee Gateway",
    brand: "Tuya",
    category: "Gateways & Hubs",
    sell: "25.00",
    buy: "16.00",
    description: "Wired Zigbee 3.0 hub for up to 128 devices.",
    weight: "0.15",
    tags: ["zigbee", "hub"],
    options: [{ name: "Connection", values: ["Wired", "Wireless"] }],
  },
  {
    name: "Tuya Multi-Mode Gateway",
    brand: "Tuya",
    category: "Gateways & Hubs",
    sell: "32.00",
    buy: "21.00",
    description: "Hub for Zigbee and Bluetooth mesh devices.",
    weight: "0.12",
    tags: ["zigbee", "bluetooth"],
  },
  {
    name: "Dahua 7-inch Indoor Monitor",
    brand: "Dahua",
    category: "Indoor Stations",
    sell: "92.00",
    buy: "65.00",
    description: "Touchscreen indoor station for Dahua IP door stations.",
    weight: "0.70",
    tags: ["indoor monitor"],
  },

  // Computing
  {
    name: "Seagate SkyHawk Surveillance Drive",
    brand: "Seagate",
    category: "Data Storage",
    sell: "62.00",
    buy: "45.00",
    description: "3.5-inch hard drive made for 24/7 recording.",
    weight: "0.60",
    tags: ["hdd", "surveillance"],
    options: [{ name: "Capacity", values: ["1 TB", "2 TB", "4 TB", "8 TB"] }],
  },
  {
    name: "Seagate Expansion Portable Drive",
    brand: "Seagate",
    category: "Data Storage",
    sell: "68.00",
    buy: "50.00",
    description: "USB 3.0 portable hard drive for backups.",
    weight: "0.20",
    tags: ["portable", "usb"],
    options: [{ name: "Capacity", values: ["1 TB", "2 TB"] }],
  },
  {
    name: "SanDisk Extreme Portable SSD",
    brand: "SanDisk",
    category: "Data Storage",
    sell: "110.00",
    buy: "82.00",
    description: "Rugged USB-C SSD with read speeds up to 1,050 MB/s.",
    weight: "0.05",
    tags: ["ssd", "usb-c"],
  },
  {
    name: "SanDisk Ultra Flash Drive",
    brand: "SanDisk",
    category: "USB Drives",
    sell: "8.00",
    buy: "4.80",
    description: "USB 3.0 flash drive with read speeds up to 130 MB/s.",
    weight: "0.02",
    tags: ["usb", "flash drive"],
    options: [{ name: "Capacity", values: ["32 GB", "64 GB", "128 GB"] }],
  },
  {
    name: "SanDisk Dual Drive USB-C",
    brand: "SanDisk",
    category: "USB Drives",
    sell: "14.00",
    buy: "8.90",
    description: "Flash drive with USB-C and USB-A connectors for phones and laptops.",
    weight: "0.02",
    tags: ["usb-c", "otg"],
  },
  {
    name: "Xprinter 80mm Receipt Printer",
    brand: "Xprinter",
    category: "Thermal Printers",
    sell: "75.00",
    buy: "52.00",
    description: "Thermal receipt printer with an auto-cutter and USB and LAN ports.",
    weight: "1.40",
    dimensions: "19x14x13 cm",
    tags: ["receipt", "pos"],
  },
  {
    name: "Xprinter Label Printer",
    brand: "Xprinter",
    category: "Thermal Printers",
    sell: "85.00",
    buy: "60.00",
    description: "Prints shipping and barcode labels up to 108 mm wide.",
    weight: "1.60",
    tags: ["label", "barcode"],
  },
  {
    name: "Thermal Paper Rolls",
    brand: "Xprinter",
    category: "Thermal Printers",
    sell: "12.00",
    buy: "7.00",
    description: "Box of 10 thermal paper rolls.",
    weight: "1.00",
    tags: ["paper", "consumables"],
    options: [{ name: "Width", values: ["57 mm", "80 mm"] }],
  },

  // Telephony
  {
    name: "Yealink T31P IP Phone",
    brand: "Yealink",
    category: "IP Phones",
    sell: "55.00",
    buy: "39.00",
    description: "Two-line entry-level IP phone with PoE and HD voice.",
    weight: "0.80",
    tags: ["ip phone", "poe"],
  },
  {
    name: "Yealink T54W IP Phone",
    brand: "Yealink",
    category: "IP Phones",
    sell: "175.00",
    buy: "128.00",
    description: "Colour touchscreen phone with built-in Bluetooth and Wi-Fi.",
    weight: "1.20",
    tags: ["touchscreen", "bluetooth"],
  },
  {
    name: "Fanvil X3U IP Phone",
    brand: "Fanvil",
    category: "IP Phones",
    sell: "62.00",
    buy: "44.00",
    description: "Six-line IP phone with a colour screen and gigabit ports.",
    weight: "0.90",
    tags: ["ip phone"],
  },
  {
    name: "Fanvil Wireless DECT Handset",
    brand: "Fanvil",
    category: "IP Phones",
    sell: "70.00",
    buy: "50.00",
    description: "DECT handset for Fanvil IP base stations.",
    weight: "0.30",
    tags: ["dect", "cordless"],
    options: [{ name: "Colour", values: ["Black", "White"] }],
  },

  // Tools & home improvement
  {
    name: "Solar Water Heater",
    brand: "Satlink",
    category: "Solar Products",
    sell: "780.00",
    buy: "560.00",
    description: "Evacuated tube solar water heater with a stainless steel tank.",
    weight: "65.00",
    tags: ["solar", "water heater"],
    options: [{ name: "Capacity", values: ["150 L", "200 L", "300 L"] }],
  },
  {
    name: "Solar Floodlight",
    brand: "Satlink",
    category: "Solar Products",
    sell: "35.00",
    buy: "22.00",
    description: "Solar-powered LED floodlight with a remote and a light sensor.",
    weight: "1.50",
    tags: ["solar", "floodlight"],
    options: [{ name: "Power", values: ["100 W", "200 W", "300 W"] }],
  },
  {
    name: "Panasonic Booster Pump",
    brand: "Panasonic",
    category: "Water Pumps",
    sell: "165.00",
    buy: "120.00",
    description: "Automatic pressure booster pump for household water supply.",
    weight: "9.00",
    tags: ["booster", "pump"],
  },
  {
    name: "Submersible Borehole Pump",
    brand: "Panasonic",
    category: "Water Pumps",
    sell: "290.00",
    buy: "210.00",
    description: "Stainless steel submersible pump for boreholes up to 60 m.",
    weight: "14.00",
    tags: ["borehole", "submersible"],
    options: [{ name: "Power", values: ["0.75 kW", "1.1 kW", "1.5 kW"] }],
  },
  {
    name: "Panasonic Ceiling Speaker",
    brand: "Panasonic",
    category: "Speakers",
    sell: "28.00",
    buy: "18.00",
    description: "6.5-inch ceiling speaker for background music and paging.",
    weight: "0.90",
    tags: ["ceiling speaker", "pa"],
  },
  {
    name: "Outdoor Horn Speaker",
    brand: "BS42.Net",
    category: "Speakers",
    sell: "32.00",
    buy: "21.00",
    description: "Weatherproof 30 W horn speaker for public address.",
    weight: "1.80",
    tags: ["horn", "pa", "outdoor"],
  },
  {
    name: "Mestek Digital Multimeter",
    brand: "Mestek",
    category: "Tools",
    sell: "24.00",
    buy: "15.00",
    description: "Auto-ranging multimeter with true RMS and a backlit display.",
    weight: "0.35",
    tags: ["multimeter"],
  },
  {
    name: "Insulated Screwdriver Set",
    brand: "Mestek",
    category: "Tools",
    sell: "19.00",
    buy: "11.50",
    description: "Seven 1000 V insulated screwdrivers for electrical work.",
    weight: "0.60",
    tags: ["screwdriver", "insulated"],
  },
  {
    name: "Cordless Drill",
    brand: "BS42.Net",
    category: "Tools",
    sell: "65.00",
    buy: "44.00",
    description: "18 V drill driver with two batteries and a charger.",
    weight: "1.90",
    tags: ["drill", "cordless"],
    options: [{ name: "Batteries", values: ["1 battery", "2 batteries"] }],
  },
  {
    name: "PPR Pipe Welding Machine",
    brand: "BS42.Net",
    category: "Plumbing Supplies",
    sell: "55.00",
    buy: "36.00",
    description: "Heat fusion welder with 20 to 63 mm dies for PPR pipes.",
    weight: "3.50",
    tags: ["ppr", "welding"],
  },
  {
    name: "PTFE Thread Seal Tape",
    brand: "BS42.Net",
    category: "Plumbing Supplies",
    sell: "2.00",
    buy: "0.70",
    description: "Pack of 10 rolls of PTFE tape for threaded joints.",
    weight: "0.10",
    tags: ["ptfe", "tape"],
  },
  {
    name: "Self-Adhesive Wall Panels",
    brand: "BS42.Net",
    category: "Floor & Wall",
    sell: "18.00",
    buy: "11.00",
    description: "Pack of 10 waterproof 3D wall panels.",
    weight: "2.00",
    tags: ["wall panels", "3d"],
    options: [{ name: "Finish", values: ["White brick", "Grey stone", "Wood"] }],
  },
  {
    name: "Vinyl Floor Tiles",
    brand: "BS42.Net",
    category: "Floor & Wall",
    sell: "28.00",
    buy: "18.50",
    description: "Box of click-lock vinyl planks covering 2 m².",
    weight: "9.00",
    tags: ["vinyl", "flooring"],
  },
  {
    name: "British General Extension Lead",
    brand: "British General",
    category: "Home Accessories",
    sell: "14.00",
    buy: "8.80",
    description: "Four-gang surge-protected extension lead.",
    weight: "0.70",
    tags: ["extension lead", "surge"],
    options: [{ name: "Cable length", values: ["2 m", "5 m"] }],
  },
  {
    name: "Ifan Smart Ceiling Fan",
    brand: "Ifan",
    category: "Home Accessories",
    sell: "135.00",
    buy: "96.00",
    description: "52-inch ceiling fan with a dimmable LED light, remote and app control.",
    weight: "6.50",
    tags: ["fan", "smart"],
  },
]

type SpecSeed = {
  // A category's name: unique in the tree, checked when seeding
  category: string
  name: string
  type: "SELECT" | "NUMBER" | "BOOLEAN" | "TEXT"
  unit?: string
  options?: string[]
}

// A spec applies to its category and every category under it, so Connection covers cameras and recorders alike
const specs: SpecSeed[] = [
  { category: "CCTV", name: "Connection", type: "SELECT", options: ["IP", "Analogue HD", "Hybrid", "Wi-Fi"] },
  { category: "CCTV Cameras", name: "Form factor", type: "SELECT", options: ["Dome", "Bullet", "Turret", "PTZ", "Cube"] },
  { category: "CCTV Cameras", name: "Resolution", type: "SELECT", options: ["2MP", "4MP", "8MP"] },
  { category: "CCTV Cameras", name: "Night vision range", type: "NUMBER", unit: "m" },
  { category: "CCTV Cameras", name: "Weatherproof", type: "BOOLEAN" },
  { category: "CCTV Cameras", name: "Two-way audio", type: "BOOLEAN" },
  { category: "CCTV Recorders", name: "Channels", type: "NUMBER" },
  { category: "CCTV Recorders", name: "Drive bays", type: "NUMBER" },
  { category: "CCTV Recorders", name: "Built-in PoE", type: "BOOLEAN" },
  { category: "Network Switches", name: "Ports", type: "NUMBER" },
  { category: "Network Switches", name: "SFP ports", type: "NUMBER" },
  { category: "Network Switches", name: "PoE", type: "BOOLEAN" },
  { category: "Network Switches", name: "Managed", type: "BOOLEAN" },
  { category: "Routers & Gateways", name: "Wi-Fi", type: "SELECT", options: ["None", "Wi-Fi 5", "Wi-Fi 6"] },
  { category: "Routers & Gateways", name: "Ethernet ports", type: "NUMBER" },
  { category: "Data Storage", name: "Drive type", type: "SELECT", options: ["HDD", "SSD"] },
  { category: "Data Storage", name: "Interface", type: "SELECT", options: ["SATA", "USB 3.0", "USB-C"] },
  { category: "IP Phones", name: "Lines", type: "NUMBER" },
  { category: "IP Phones", name: "PoE", type: "BOOLEAN" },
  { category: "IP Phones", name: "Colour screen", type: "BOOLEAN" },
  { category: "Network Cables", name: "Cable category", type: "SELECT", options: ["Cat5e", "Cat6", "Cat6a"] },
  { category: "Network Cables", name: "Shielded", type: "BOOLEAN" },
  { category: "Network Cables", name: "Outdoor rated", type: "BOOLEAN" },
  { category: "Smart Devices", name: "Protocol", type: "SELECT", options: ["Wi-Fi", "Zigbee", "Bluetooth"] },
]

// The sample products' values, by product and spec name. A spec a product varies by (a camera sold in 2MP and 4MP)
// is a variant option instead, so it has no value here.
const productSpecs: Record<string, Record<string, string | number | boolean>> = {
  "Hikvision 2MP Dome Camera": { Connection: "Analogue HD", "Form factor": "Dome", Resolution: "2MP", "Night vision range": 20, Weatherproof: false },
  "Hikvision 4MP Bullet Camera": { Connection: "IP", "Form factor": "Bullet", Resolution: "4MP", "Night vision range": 30, Weatherproof: true },
  "Hikvision ColorVu Turret Camera": { Connection: "IP", "Form factor": "Turret", Weatherproof: true },
  "Dahua 2MP HDCVI Bullet Camera": { Connection: "Analogue HD", "Form factor": "Bullet", Resolution: "2MP", Weatherproof: true },
  "Dahua 4MP PTZ Camera": { Connection: "IP", "Form factor": "PTZ", Resolution: "4MP", "Night vision range": 100, Weatherproof: true },
  "Dahua Wi-Fi Cube Camera": { Connection: "Wi-Fi", "Form factor": "Cube", Weatherproof: false, "Two-way audio": true },
  "Hikvision 8-Channel NVR": { Connection: "IP", "Built-in PoE": true },
  "Dahua 16-Channel XVR": { Connection: "Hybrid", Channels: 16, "Drive bays": 2, "Built-in PoE": false },
  "Hikvision 4-Channel DVR": { Connection: "Analogue HD", Channels: 4, "Drive bays": 1, "Built-in PoE": false },
  "Mikrotik CRS326 Switch": { Ports: 24, "SFP ports": 2, PoE: false, Managed: true },
  "Omada 8-Port PoE Switch": { PoE: true, Managed: true },
  "Cisco CBS250 24-Port Switch": { Ports: 24, "SFP ports": 4, PoE: false, Managed: true },
  "Ubiquiti UniFi Flex Mini": { Ports: 5, "SFP ports": 0, PoE: false, Managed: true },
  "Mikrotik hAP ax2": { "Wi-Fi": "Wi-Fi 6", "Ethernet ports": 5 },
  "Mikrotik RB5009": { "Wi-Fi": "None", "Ethernet ports": 8 },
  "Omada ER605 VPN Router": { "Wi-Fi": "None" },
  "Seagate SkyHawk Surveillance Drive": { "Drive type": "HDD", Interface: "SATA" },
  "Seagate Expansion Portable Drive": { "Drive type": "HDD", Interface: "USB 3.0" },
  "SanDisk Extreme Portable SSD": { "Drive type": "SSD", Interface: "USB-C" },
  "Yealink T31P IP Phone": { Lines: 2, PoE: true, "Colour screen": false },
  "Yealink T54W IP Phone": { PoE: true, "Colour screen": true },
  "Fanvil X3U IP Phone": { Lines: 6, "Colour screen": true },
  "Cat6 UTP Cable Box": { "Cable category": "Cat6", Shielded: false, "Outdoor rated": false },
  "Cat6 Patch Cable": { "Cable category": "Cat6", Shielded: false, "Outdoor rated": false },
  "Outdoor Cat6 FTP Cable": { "Cable category": "Cat6", Shielded: true, "Outdoor rated": true },
  "Tuya Smart LED Bulb": { Protocol: "Wi-Fi" },
  "Tuya Smart Downlight": { Protocol: "Wi-Fi" },
  "Lanbon Smart Touch Switch": { Protocol: "Zigbee" },
  "Ifan Smart Dimmer Switch": { Protocol: "Wi-Fi" },
  "Tuya Smart Plug": { Protocol: "Wi-Fi" },
  "TT Lock Smart Door Lock": { Protocol: "Bluetooth" },
  "D'Locks Smart Padlock": { Protocol: "Bluetooth" },
  "Tuya Smart Curtain Motor": { Protocol: "Wi-Fi" },
  "Tuya PIR Motion Sensor": { Protocol: "Zigbee" },
  "LED Strip Controller": { Protocol: "Wi-Fi" },
}

const counts = { created: 0, skipped: 0 }

// As the console's actions use: a product with many variants makes many round trips to a remote database
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

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

// A plain-text description as the editor's JSON, which is how the product form saves it
function richText(text: string) {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
}

// Every combination of the options' values, as { option: value } maps
function combinations(options: { name: string; values: string[] }[]) {
  return options.reduce<Record<string, string>[]>((rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))), [{}])
}

async function leafCategoryIds() {
  const rows = await prisma.category.findMany({ where: { childCategories: { none: {} } }, select: { id: true, name: true } })
  const ids = new Map<string, string>()
  for (const { id, name } of rows) {
    if (ids.has(name)) throw new Error(`More than one leaf category is called ${name}`)
    ids.set(name, id)
  }
  return ids
}

async function seedProducts() {
  const categoryIds = await leafCategoryIds()
  const brandIds = new Map((await prisma.brand.findMany({ select: { id: true, name: true } })).map(({ id, name }) => [name, id]))

  for (const { brand, category, sell, buy, description, weight, dimensions, tags = [], options = [], ...data } of products) {
    if (await prisma.product.findFirst({ where: { name: data.name }, select: { id: true } })) {
      counts.skipped++
      continue
    }

    const brandId = brandIds.get(brand)
    const categoryId = categoryIds.get(category)
    if (!brandId) throw new Error(`${data.name}: no brand called ${brand}`)
    if (!categoryId) throw new Error(`${data.name}: no leaf category called ${category}`)

    const hasVariants = options.length > 0

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...data,
          // Placeholder: the Prisma hook generates the real slug, and a SKU for a simple product
          slug: "",
          brandId,
          categoryId,
          baseSellPrice: sell,
          baseBuyPrice: buy,
          description: richText(description),
          tags,
          status: "PUBLISHED",
          hasVariants,
          ...(!hasVariants && { weight: weight ?? null, dimensions: dimensions ?? null }),
          variantOptions: {
            create: options.map((option, position) => ({
              name: option.name,
              position,
              values: { create: option.values.map((value, valuePosition) => ({ value, position: valuePosition })) },
            })),
          },
        },
        select: { id: true, name: true, variantOptions: { select: { name: true, values: { select: { id: true, value: true } } } } },
      })

      const valueIds = new Map(product.variantOptions.flatMap((option) => option.values.map((value) => [`${option.name}\u0000${value.value}`, value.id])))

      // One at a time, as in createProductAction: tx sees the variants created before this one, so their SKUs count as taken
      for (const [position, attributes] of (hasVariants ? combinations(options) : []).entries()) {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: await generateUniqueSku(tx, product.name),
            weight: weight ?? null,
            dimensions: dimensions ?? null,
            position,
            variantValues: { create: Object.entries(attributes).map(([option, value]) => ({ optionValueId: valueIds.get(`${option}\u0000${value}`)! })) },
          },
        })
      }
    }, TRANSACTION_OPTIONS)
    counts.created++
  }
}

async function seedSpecs() {
  const categoryRows = await prisma.category.findMany({ select: { id: true, name: true } })
  for (const { category, options = [], ...spec } of specs) {
    const matches = categoryRows.filter((row) => row.name === category)
    if (matches.length !== 1) throw new Error(`${spec.name}: expected one category called ${category}, found ${matches.length}`)
    const categoryId = matches[0]!.id

    let saved = await prisma.categorySpec.findUnique({ where: { categoryId_name: { categoryId, name: spec.name } }, select: { id: true, options: { select: { value: true } } } })
    if (saved) {
      counts.skipped++
    } else {
      const last = await prisma.categorySpec.aggregate({ where: { categoryId }, _max: { position: true } })
      saved = await prisma.categorySpec.create({ data: { ...spec, categoryId, position: (last._max.position ?? -1) + 1 }, select: { id: true, options: { select: { value: true } } } })
      counts.created++
    }

    // Options added to the list later are added to a spec that's already there
    const have = new Set(saved.options.map((option) => option.value))
    const missing = options.filter((value) => !have.has(value))
    if (missing.length) await prisma.categorySpecOption.createMany({ data: missing.map((value) => ({ specId: saved.id, value, position: options.indexOf(value) })) })
  }
}

async function seedProductSpecs() {
  const categoryRows = await prisma.category.findMany({ select: { id: true, parentId: true } })
  const parents = new Map(categoryRows.map((row) => [row.id, row.parentId]))
  const allSpecs = await prisma.categorySpec.findMany({ select: { id: true, categoryId: true, name: true, type: true, options: { select: { id: true, value: true } } } })

  for (const [productName, values] of Object.entries(productSpecs)) {
    const product = await prisma.product.findFirst({ where: { name: productName }, select: { id: true, categoryId: true, specValues: { select: { specId: true } } } })
    if (!product) throw new Error(`Spec values for ${productName}, which isn't a product`)

    // The product's category and every category above it
    const chain = new Set<string>()
    for (let id: string | null | undefined = product.categoryId; id; id = parents.get(id)) chain.add(id)
    const has = new Set(product.specValues.map((value) => value.specId))

    const data = Object.entries(values).flatMap(([specName, value]): Prisma.ProductSpecValueCreateManyInput[] => {
      const spec = allSpecs.find((row) => row.name === specName && chain.has(row.categoryId))
      if (!spec) throw new Error(`${productName}: its category has no spec called ${specName}`)
      if (has.has(spec.id)) {
        counts.skipped++
        return []
      }
      counts.created++
      switch (spec.type) {
        case "SELECT": {
          const option = spec.options.find((row) => row.value === value)
          if (!option) throw new Error(`${productName}: ${specName} has no option ${value}`)
          return [{ productId: product.id, specId: spec.id, optionId: option.id }]
        }
        case "NUMBER":
          return [{ productId: product.id, specId: spec.id, numberValue: Number(value) }]
        case "BOOLEAN":
          return [{ productId: product.id, specId: spec.id, booleanValue: value === true }]
        case "TEXT":
          return [{ productId: product.id, specId: spec.id, textValue: String(value) }]
      }
    })
    if (data.length) await prisma.productSpecValue.createMany({ data })
  }
}

const DEMO_STORE_NAME = "BS42 Demo Store"
// GH₵ per US$1, made up: set the real one in Settings
const DEMO_EXCHANGE_RATE = "15.500000"
const DEMO_LOW_STOCK_THRESHOLD = 5

// A row's stock, varied but the same on every run: some out of stock, some low, the rest 8 to 37
function demoStock(n: number) {
  if (n % 9 === 4) return 0
  if (n % 9 === 7) return 3
  return 8 + (n % 30)
}

// The store and its members. Better Auth's afterCreateOrganization hook doesn't run for a Prisma write, so this adds the
// system admins as it does: superAdmins as owners, admins as admins (as storeRoleForSystemAdmin in @workspace/auth,
// which this package can't import).
async function seedDemoStore() {
  let store = await prisma.organization.findFirst({ where: { name: DEMO_STORE_NAME }, select: { id: true } })
  if (store) {
    counts.skipped++
  } else {
    // Placeholder: the Prisma hook generates the real slug from the name
    store = await prisma.organization.create({ data: { name: DEMO_STORE_NAME, slug: "" }, select: { id: true } })
    counts.created++
  }

  const users = await prisma.user.findMany({ where: { role: { contains: "dmin" } }, select: { id: true, role: true } })
  const systemAdmins = users.flatMap(({ id, role }) => {
    const roles = (role ?? "").split(",").map((name) => name.trim())
    if (roles.includes("superAdmin")) return [{ userId: id, role: "owner" }]
    if (roles.includes("admin")) return [{ userId: id, role: "admin" }]
    return []
  })
  if (systemAdmins.length) await prisma.member.createMany({ data: systemAdmins.map((member) => ({ ...member, organizationId: store.id })), skipDuplicates: true })

  return { storeId: store.id, createdById: systemAdmins.find((member) => member.role === "owner")?.userId ?? null }
}

// A listing for most published products (every 8th is left out, for trying "Add listing"). Every 6th is on sale (a
// compare-at price), every 10th featured, every 12th doesn't track stock. Hidden from customers: every 20th listing is a
// draft, and on every 10th product with variants no variant is on sale. On every 3rd product, if it has variants, the
// last one has its own price. Each listing's stock gets an "Initial stock" entry, as the listing form
// writes.
async function seedDemoListings(storeId: string, createdById: string | null) {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: { id: true, baseSellPrice: true, baseBuyPrice: true, hasVariants: true, variants: { where: { status: "PUBLISHED" }, orderBy: { position: "asc" }, select: { id: true } } },
  })
  const listed = new Set((await prisma.storeListing.findMany({ where: { organizationId: storeId }, select: { productId: true } })).map((row) => row.productId))

  let withVariants = 0
  for (const [i, product] of products.entries()) {
    if (product.hasVariants) withVariants++
    if (i % 8 === 7) continue
    if (listed.has(product.id)) {
      counts.skipped++
      continue
    }
    if (product.baseSellPrice.lte(0) || (product.hasVariants && !product.variants.length)) continue

    const sellPrice = product.baseSellPrice
    const trackInventory = i % 12 !== 5
    const variantsOffSale = product.hasVariants && withVariants % 10 === 5

    await prisma.$transaction(async (tx) => {
      const listing = await tx.storeListing.create({
        select: { id: true, stock: true, storeListingVariants: { select: { id: true, stock: true } } },
        data: {
          organizationId: storeId,
          productId: product.id,
          sellPrice,
          buyPrice: product.baseBuyPrice,
          compareAtPrice: i % 6 === 0 ? sellPrice.mul("1.2").toDecimalPlaces(2) : null,
          stock: product.hasVariants ? 0 : demoStock(i * 7),
          lowStockThreshold: DEMO_LOW_STOCK_THRESHOLD,
          trackInventory,
          isFeatured: i % 10 === 1,
          status: i % 20 === 10 ? "DRAFT" : "PUBLISHED",
          storeListingVariants: {
            create: product.variants.map((variant, position) => ({
              variantId: variant.id,
              sellPrice: i % 3 === 0 && position === product.variants.length - 1 && position > 0 ? sellPrice.mul("1.1").toDecimalPlaces(2) : null,
              stock: demoStock(i * 7 + position * 3),
              status: variantsOffSale ? "DRAFT" : "PUBLISHED",
              trackInventory,
              lowStockThreshold: DEMO_LOW_STOCK_THRESHOLD,
            })),
          },
        },
      })
      const rows = [{ variantId: null, stock: listing.stock }, ...listing.storeListingVariants.map((row) => ({ variantId: row.id, stock: row.stock }))]
      const movements = rows.filter((row) => row.stock > 0)
      if (movements.length) {
        await tx.stockMovement.createMany({
          data: movements.map((row) => ({ storeListingId: listing.id, storeListingVariantId: row.variantId, change: row.stock, stockAfter: row.stock, reason: "INITIAL", createdById })),
        })
      }
    }, TRANSACTION_OPTIONS)
    counts.created++
  }
}

// Today's USD→GHS rate, unless today already has one. Accra is on UTC all year, so today's date there is the UTC date.
async function seedDemoExchangeRate() {
  const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  if (await prisma.exchangeRate.findUnique({ where: { from_to_date: { from: "USD", to: "GHS", date } }, select: { id: true } })) return false
  await prisma.exchangeRate.create({ data: { from: "USD", to: "GHS", date, rate: new Prisma.Decimal(DEMO_EXCHANGE_RATE), source: "MANUAL" } })
  return true
}

async function main() {
  await seedCategories(categories, null)
  console.log(`Categories: ${counts.created} created, ${counts.skipped} already there`)

  counts.created = 0
  counts.skipped = 0
  await seedBrands()
  console.log(`Brands: ${counts.created} created, ${counts.skipped} already there`)

  counts.created = 0
  counts.skipped = 0
  await seedProducts()
  console.log(`Products: ${counts.created} created, ${counts.skipped} already there`)

  counts.created = 0
  counts.skipped = 0
  await seedSpecs()
  console.log(`Specifications: ${counts.created} created, ${counts.skipped} already there`)

  counts.created = 0
  counts.skipped = 0
  await seedProductSpecs()
  console.log(`Product spec values: ${counts.created} created, ${counts.skipped} already there`)

  if (!process.argv.includes("--demo")) return

  counts.created = 0
  counts.skipped = 0
  const { storeId, createdById } = await seedDemoStore()
  console.log(`Demo store: ${counts.created ? "created" : "already there"}`)
  if (!createdById) console.log("No superAdmin yet, so the demo store has no owner: run /setup, then seed again to add one")

  counts.created = 0
  counts.skipped = 0
  await seedDemoListings(storeId, createdById)
  console.log(`Demo listings: ${counts.created} created, ${counts.skipped} already there`)

  console.log(`Today's exchange rate: ${(await seedDemoExchangeRate()) ? `set to ${DEMO_EXCHANGE_RATE}` : "already set"}`)
}

try {
  await main()
} catch (error) {
  console.error("Seeding failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
