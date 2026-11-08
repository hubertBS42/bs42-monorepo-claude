import { prisma } from "../src/client"
const mode = process.argv[2]
const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" }) + "T00:00:00Z")
if (mode === "add") {
  const latest = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" }, select: { date: true, rate: true, from: true, to: true } })
  if (latest && latest.date.getTime() === today.getTime()) console.log("today already has a rate:", latest.rate.toString())
  else {
    const row = await prisma.exchangeRate.create({ data: { from: latest!.from, to: latest!.to, rate: latest!.rate, marketRate: latest!.rate, date: today, source: "MANUAL" } as never, select: { id: true } })
    console.log("added test rate", row.id, "from", latest!.date.toISOString().slice(0, 10))
  }
} else {
  const { count } = await prisma.exchangeRate.deleteMany({ where: { id: process.argv[3] } })
  console.log("removed", count)
}
await prisma.$disconnect()
