// Seeds the starting catalogue: the category tree and brands carried over from the old BS42 app, the old app's products
// (seed-products.json), and specifications for some categories.
// Safe to run again: a category that already exists under the same parent, a brand with the same name, a product whose
// name already has as many products as the file gives it, or a spec its category already has is skipped.
// Run with `pnpm --filter @workspace/db db:seed`.
//
// seed-products.json was built from the old app's export (in the bs42-legacy-products folder beside this repo) by its
// scripts/build-seed-data.mts. Its images and documents are already in the storage container: a product deleted in the
// console takes its files with it, so seeding it again gives it broken images.
//
// `db:seed:demo` (`--demo`) also adds a demo store to browse and order from: listings for most published products, with
// a mix of stock levels, sale prices and a few listings hidden from customers, and today's exchange rate if there's none.
// It's for development databases only: the rate is made up.
import { readFile } from "node:fs/promises"
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

// A product in seed-products.json. Prices are USD, as strings so they reach the Decimal columns exactly. `category` is a
// leaf category's name, `description` the editor's JSON, and the files are URLs in the storage container. `from` names
// the old product(s) it was made from. Each of `variants` has a value for every option, and its old product's prices:
// catalogue variants have no price of their own, so only the demo store's listings use them.
type ProductSeed = {
  from: string[]
  name: string
  brand: string
  category: string
  condition: "NEW" | "USED_GOOD"
  sell: string
  buy: string
  status: "PUBLISHED" | "DRAFT"
  description: string | null
  tags: string[]
  images: string[]
  documents: { name: string; url: string }[]
  options?: { name: string; values: string[] }[]
  variants?: { values: Record<string, string>; sell: string; buy: string; images: string[] }[]
}

const productSeeds: ProductSeed[] = JSON.parse(await readFile(new URL("./seed-products.json", import.meta.url), "utf8"))

const categories: CategorySeed[] = [
  {
    name: "Security",
    description: "CCTV, access control and alarm systems to protect homes, offices and businesses, day and night.",
    children: [
      {
        name: "CCTV",
        description: "Cameras, recorders, accessories and complete camera packages for watching over your home or business.",
        children: [
          { name: "CCTV Cameras", description: "IP, analogue HD, dome, PTZ and fisheye cameras with night vision, for indoor and outdoor surveillance." },
          { name: "CCTV Recorders", description: "DVRs and PoE NVRs from 4 to 32 channels, recording up to 4K, to store and review your camera footage." },
          { name: "CCTV Accessories", description: "Brackets, junction boxes, connectors, baluns, microphones and power supplies for a clean, reliable CCTV installation." },
          { name: "CCTV Installation Packages", description: "Ready-made 4, 6 and 8 camera kits with a recorder, for a complete CCTV system in one order." },
        ],
      },
      {
        name: "Access Control",
        description: "Card readers, electromagnetic locks, exit buttons, intercoms and gate openers to control who comes through your doors and gates.",
        children: [
          { name: "Card Readers", description: "RFID proximity card readers for door entry, working with standard Wiegand access controllers." },
          { name: "Electronic Locks", description: "Electromagnetic door locks and their mounting brackets for secure, controlled entry." },
          { name: "Exit Buttons", description: "Door release exit buttons and call points for letting people out through access-controlled doors." },
          { name: "Intercoms", description: "Audio and video intercoms and video doorbells, including IP and PoE door stations, to see and speak to visitors before letting them in." },
          { name: "Power Supplies", description: "Access controllers and power supplies that keep your locks and readers running." },
          { name: "Accessories", description: "RFID key fobs, cards, tags and other accessories for access control systems." },
          { name: "Gate Automation", description: "Sliding and swing gate openers, gear racks and Wi-Fi receivers to open your gate from a remote or your phone." },
        ],
      },
      {
        name: "Alarms",
        description: "Fire and intruder alarm systems that alert you the moment something goes wrong.",
        children: [
          { name: "Fire Alarms", description: "Smoke and heat detectors and fire alarm panels for early warning in homes and workplaces." },
          { name: "Intruder Alarms", description: "Wi-Fi, GSM and solar-powered alarm systems that sound and send alerts when someone breaks in." },
        ],
      },
    ],
  },
  {
    name: "Networking",
    description: "Switches, routers, Wi-Fi access points, cabling and tools to build and run reliable home and business networks.",
    children: [
      {
        name: "Infrastructure",
        description: "Patch panels, rack-mount cable management and structured cabling to keep server rooms and comms cabinets in order.",
        children: [
          { name: "Network Infrastructure", description: "Patch panels and structured cabling components for a network's backbone across offices and buildings." },
          { name: "Cable Management", description: "Rack-mount brush panels and cable organisers that keep patch cords tidy and cabinets easy to work in." },
        ],
      },
      {
        name: "Networking Devices",
        description: "Switches, routers, access points and cabinets: the active equipment that keeps your network connected.",
        children: [
          { name: "Network Switches", description: "Unmanaged, smart and PoE Ethernet switches, from 5-port desktop models to 48-port rack-mount Gigabit switches." },
          { name: "Routers & Gateways", description: "Wired, Wi-Fi and 4G LTE routers and gateways from MikroTik, TP-Link, Zisa and more." },
          { name: "Wireless Accessories", description: "Indoor and outdoor access points, wireless bridges and CPEs for Wi-Fi throughout a building or across a compound." },
          { name: "Network Cabinets", description: "Data racks and cabinets to house switches, patch panels and recorders safely in one place." },
          { name: "Network Tools", description: "Cable testers and tracers, punch-down tools, laser levels and meters for installers and technicians." },
        ],
      },
      {
        name: "Cables",
        description: "Network, HDMI and power cables, with the plugs, connectors and faceplates to finish every connection.",
        children: [
          { name: "Network Cables", description: "Cat5e and Cat6 UTP cable and patch cords for fast, dependable wired connections between devices, rooms and buildings." },
          { name: "Audio & Video Cables", description: "HDMI, VGA and DVI cables and HDMI extenders for connecting TVs, projectors, monitors and recorders." },
          { name: "Power Cables", description: "Power cords, kettle leads, AC and PoE adapters and power distribution units for computers, racks and equipment." },
          { name: "Plugs & Connectors", description: "RJ45 plugs, boots and couplers, PoE injectors and console cables for joining and extending your cabling." },
          { name: "Modules & Faceplates", description: "Keystone jacks and wall faceplates for neat, professional network points." },
        ],
      },
    ],
  },
  {
    name: "Smart Homes",
    description: "Smart locks, lighting, curtains, switches and hubs to run your home from your phone.",
    children: [
      {
        name: "Smart Devices",
        description: "Smart lights, switches, plugs, locks, curtain motors and sensors for a more comfortable, automated home.",
        children: [
          { name: "Smart Lights", description: "App-controlled downlights, floor lamps, LED strip kits and lighting controllers you can dim, colour and schedule from your phone." },
          { name: "Smart Switches", description: "Wi-Fi wall, fan, curtain and water heater switches, hotel key-card switches and switch modules that make your wiring smart." },
          { name: "Smart Plugs", description: "Wi-Fi smart plugs and timer sockets that switch appliances on and off from your phone or on a schedule." },
          { name: "Smart Locks", description: "Fingerprint, PIN, card, face recognition and Bluetooth smart locks for homes, offices and hotels." },
          { name: "Smart Curtains", description: "Motorised curtain tracks, tubular blind motors, remotes and parts for curtains that open at a tap or on a schedule." },
          { name: "Motion Sensors", description: "Wi-Fi motion sensors that alert your phone when they detect movement." },
          { name: "LED Accessories", description: "LED strips, wiring, aluminium profiles, controllers, connectors and power supplies for custom lighting." },
        ],
      },
      {
        name: "Control Systems",
        description: "Control panels, remotes and smart gateways that bring your smart home devices together.",
        children: [
          { name: "Control Panels", description: "Touch control panels and universal remotes for running lights, curtains, air conditioning and media from one place." },
          { name: "Gateways & Hubs", description: "ZigBee and Wi-Fi gateways that connect smart locks and sensors to your phone." },
          { name: "Indoor Stations", description: "SIP indoor intercom stations for answering the door from inside your home." },
        ],
      },
    ],
  },
  {
    name: "Computing",
    description: "Data storage, USB adapters and printers to get more out of your computers at home or at work.",
    children: [
      {
        name: "Computers & Accessories",
        description: "Hard drives, USB adapters and printers for your desktops and laptops.",
        children: [
          { name: "Data Storage", description: "Hard drives for CCTV recorders and computers, and SATA adapters to connect and back up your drives." },
          { name: "USB Drives", description: "USB flash drives, adapters and extension cables, such as Bluetooth dongles and USB sound cards." },
          {
            name: "Printers",
            description: "Printers for shops, offices and point of sale, including compact thermal receipt printers.",
            children: [{ name: "Thermal Printers", description: "Compact thermal printers for receipts and labels, with no ink or toner to replace." }],
          },
        ],
      },
    ],
  },
  {
    name: "Telephony",
    description: "IP and digital desk phones and business phone systems from Avaya, Cisco, Panasonic, Polycom and Siemens.",
    children: [
      {
        name: "VOIP",
        description: "SIP and IP phones for clear, flexible voice calls over your network.",
        children: [{ name: "IP Phones", description: "SIP, IP and digital desk phones from Cisco, Panasonic, Polycom and Siemens, many powered over Ethernet." }],
      },
      { name: "Phone Systems", description: "Business phone systems (PBXs) from Avaya, Panasonic and Siemens that connect your office's lines and extensions." },
    ],
  },
  {
    name: "Tools & Home Improvement",
    description: "Tools, solar water heaters, pumps, kitchens, pergolas and electrical supplies for building and upgrading your home.",
    children: [
      {
        name: "Electrical",
        description: "Solar water heaters, pumps, electrical components, speakers, TVs and projectors, and tools for the home and the job site.",
        children: [
          { name: "Solar Products", description: "Solar water heaters and hot water storage tanks that cut the cost of heating water." },
          { name: "Water Pumps", description: "Self-priming pumps for hot and cold water that keep the pressure up across your home." },
          { name: "Speakers", description: "Bluetooth ceiling speakers and smart music hosts for sound around a home or business." },
          { name: "TV & Projectors", description: "Projectors and motorised TV lifts for home cinemas, living rooms and meeting rooms." },
          { name: "Electrical Components", description: "Contactors, time switches and weatherproof outdoor sockets for electrical installations." },
          { name: "Tools", description: "Tool sets, nail guns, wall chasers and grooving machines for installers, tradespeople and jobs around the home." },
        ],
      },
      {
        name: "Plumbing",
        description: "Plumbing tools and supplies for installing and repairing water pipes.",
        children: [{ name: "Plumbing Supplies", description: "Pipe welding machines, shower fittings and supplies for plumbing work." }],
      },
      {
        name: "Home Improvement",
        description: "Kitchens, pergolas and home fittings for upgrading your home inside and out.",
        children: [
          { name: "Floor & Wall", description: "Flooring and wall products for building and renovation work." },
          { name: "Kitchen", description: "Sinks, gas cookers and burners, built-in grills, blenders and outdoor kitchen units for indoor and outdoor kitchens." },
          { name: "Pergolas", description: "Louvred pergolas and 4x4 post brackets for shaded outdoor living spaces." },
          { name: "Home Accessories", description: "Appliance and fridge guards, shoe racks, door hardware, key lock boxes and other fittings for around the home." },
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

async function leafCategoryIds() {
  const rows = await prisma.category.findMany({ where: { childCategories: { none: {} } }, select: { id: true, name: true } })
  const ids = new Map<string, string>()
  for (const { id, name } of rows) {
    if (ids.has(name)) throw new Error(`More than one leaf category is called ${name}`)
    ids.set(name, id)
  }
  return ids
}

// Two old products can share a name (there are two Smart LED Downlights), so a name is done once it has as many products
// as the file gives it
async function seedProducts() {
  const categoryIds = await leafCategoryIds()
  const brandIds = new Map((await prisma.brand.findMany({ select: { id: true, name: true } })).map(({ id, name }) => [name, id]))
  const existing = new Map<string, number>()
  for (const { name } of await prisma.product.findMany({ select: { name: true } })) existing.set(name, (existing.get(name) ?? 0) + 1)

  for (const { from, brand, category, sell, buy, documents, options = [], variants = [], ...data } of productSeeds) {
    const left = existing.get(data.name) ?? 0
    if (left > 0) {
      existing.set(data.name, left - 1)
      counts.skipped++
      continue
    }

    const brandId = brandIds.get(brand)
    const categoryId = categoryIds.get(category)
    if (!brandId) throw new Error(`${data.name} (${from.join(", ")}): no brand called ${brand}`)
    if (!categoryId) throw new Error(`${data.name} (${from.join(", ")}): no leaf category called ${category}`)

    const hasVariants = variants.length > 0

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
          hasVariants,
          documents: { create: documents },
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
      for (const [position, variant] of variants.entries()) {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: await generateUniqueSku(tx, product.name),
            images: variant.images,
            position,
            variantValues: { create: Object.entries(variant.values).map(([option, value]) => ({ optionValueId: valueIds.get(`${option}\u0000${value}`)! })) },
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
// draft, and on every 10th product with variants no variant is on sale. A variant whose old product had other prices than
// the product keeps them on its listing row. Each listing's stock gets an "Initial stock" entry, as the listing form
// writes.
async function seedDemoListings(storeId: string, createdById: string | null) {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseSellPrice: true,
      baseBuyPrice: true,
      hasVariants: true,
      variants: { where: { status: "PUBLISHED" }, orderBy: { position: "asc" }, select: { id: true, position: true } },
    },
  })
  // Each variant's old prices, by product name and then the variant's position (seedProducts creates them in file order)
  const variantPrices = new Map(productSeeds.flatMap((seed) => (seed.variants ? [[seed.name, seed.variants] as const] : [])))
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
            create: product.variants.map((variant, position) => {
              const prices = variantPrices.get(product.name)?.[variant.position]
              return {
                variantId: variant.id,
                sellPrice: prices && !sellPrice.equals(prices.sell) ? new Prisma.Decimal(prices.sell) : null,
                buyPrice: prices && !product.baseBuyPrice.equals(prices.buy) ? new Prisma.Decimal(prices.buy) : null,
                stock: demoStock(i * 7 + position * 3),
                status: variantsOffSale ? "DRAFT" : "PUBLISHED",
                trackInventory,
                lowStockThreshold: DEMO_LOW_STOCK_THRESHOLD,
              }
            }),
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
