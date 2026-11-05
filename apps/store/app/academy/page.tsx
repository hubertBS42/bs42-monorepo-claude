import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

// The old bs42.net's Academy page, at its old address. The courses, schedule and price are written here, as they were
// on the old site: change them in this file.
export const metadata: Metadata = {
  title: "BS42 Academy",
  description: "Hands-on CCTV installation and data cabling courses, with a certificate and reseller prices afterwards.",
  alternates: { canonical: "/academy" },
}

const COURSES = [
  {
    title: "CCTV Installation",
    image: "/images/academy/cctv-installation.jpg",
    summary:
      "Everything you need to know about CCTV, from camera types and RJ45 crimping to network configuration and remote access. You'll also learn the standards and regulations to follow, and how to deal with customers professionally.",
    details: [
      "The basic course covers setting up and maintaining a CCTV system: site safety and the right use of tools, placing cameras, RJ45 crimping, setting up recorders, maintenance, troubleshooting and more.",
      "The advanced course takes you further: network setups for remote access, cloud and alarm integration, disaster recovery, VPNs and more.",
    ],
  },
  {
    title: "Data Cabling",
    image: "/images/academy/data-cabling.jpg",
    summary:
      "Data cabling is the backbone of every network, at home, in the office or on an industrial site. This course gives you the skills to install structured cabling for fast data networks in commercial and residential buildings.",
    details: [
      "You'll learn to install, maintain and troubleshoot cables carrying voice, data and video, working with Category 5, 6 and 7 and coaxial cable, to industry standards and best practice for installation and testing.",
      "You'll work with real equipment on real-world jobs, guided by our instructors, whether you're starting a new career or adding to your skills.",
    ],
  },
]

const SCHEDULE = [
  { label: "Duration", regular: "3 days", weekend: "2 days" },
  { label: "Training days", regular: "Wednesday, Thursday, Friday", weekend: "Saturday, Sunday" },
  { label: "Hours per week", regular: "At least 6", weekend: "At least 6" },
  { label: "Price", regular: "GHS 400.00", weekend: "GHS 400.00" },
]

const REQUIREMENTS = ["Basic education", "Able to read and write in English", "Basic electrical knowledge", "18 years or older"]

const KIT = ["Crimping tool", "30 RJ45 connectors", "Analogue CCTV camera", "BNC connectors", "Cable tester", "CCTV video balun", "Male and female power connectors"]

export default function AcademyPage() {
  return (
    <div className="pb-16">
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static file in public/ */}
        <img src="/images/academy/banner.jpg" alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <div className="mx-auto max-w-7xl px-4 py-20 text-white md:py-32 lg:px-6">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">Welcome to BS42 Academy</h1>
          <p className="mt-4 max-w-xl text-lg text-white/90">
            Looking for a rewarding career in security and networking? Learn to install, maintain and troubleshoot CCTV and network systems with BS42 Academy.
          </p>
          <Button render={<Link href="/contact-us" />} size="lg" className="mt-8">
            Contact us to enrol
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 lg:px-6">
        <header className="mt-14 mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Our courses</h2>
          <p className="mt-2 text-muted-foreground">Each ends with a certificate, and a place on our reseller programme: buy anything from us at reseller prices.</p>
        </header>

        <div className="grid gap-6">
          {COURSES.map((course) => (
            <article key={course.title} className="grid overflow-hidden rounded-xl border md:grid-cols-[2fr_3fr]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static file in public/ */}
              <img src={course.image} alt="" loading="lazy" className="aspect-video size-full object-cover md:aspect-auto" />
              <div className="p-6">
                <h3 className="text-2xl font-semibold">{course.title}</h3>
                <p className="mt-3">{course.summary}</p>
                {course.details.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="schedule">
          <h2 id="schedule" className="text-2xl font-bold tracking-tight">
            Schedule and price
          </h2>
          <p className="mt-1 text-muted-foreground">The same for both courses: choose weekday or weekend classes.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Weekday classes</TableHead>
                  <TableHead>Weekend classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SCHEDULE.map((row) => (
                  <TableRow key={row.label}>
                    <TableHead scope="row">{row.label}</TableHead>
                    <TableCell className="whitespace-normal">{row.regular}</TableCell>
                    <TableCell className="whitespace-normal">{row.weekend}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <CheckList title="Who can join" items={REQUIREMENTS} />
          <CheckList title="What you take home" items={KIT} />
        </div>

        <div className="mt-12 rounded-xl bg-muted p-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready to start?</h2>
          <p className="mt-2 text-muted-foreground">Contact us to find out more and book your place.</p>
          <Button render={<Link href="/contact-us" />} className="mt-4">
            Contact us
          </Button>
        </div>
      </div>
    </div>
  )
}

function CheckList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
