import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, Mail, ShoppingBag, Users } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import { capitalizeWord } from "@workspace/utils/text"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreById } from "@/lib/data/stores.data"
import StoreActions from "./_components/store-actions"

export const metadata: Metadata = {
  title: "Store Details",
}

const storeLinks = [
  {
    href: "/store/listings",
    icon: ShoppingBag,
    title: "Listings",
    description: "View and manage this store's listings",
  },
  {
    href: "/store/members",
    icon: Users,
    title: "Members",
    description: "View and manage this store's members",
  },
  {
    href: "/store/invitations",
    icon: Mail,
    title: "Invitations",
    description: "View and manage this store's invitations",
  },
]

const StoreOverviewPage = async () => {
  const { storeId } = await requireActiveStoreMember()

  const response = await getStoreById(storeId)
  if (!response.success) throw new Error(response.error)
  const store = response.data

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Store Details</h1>
        <p className="text-sm text-muted-foreground">This store&apos;s details, its pages, and leaving or deleting it.</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{store.name}</CardTitle>
            <CardDescription>General information about this store</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{store.name}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Slug</p>
                <p className="font-mono text-sm font-medium">{store.slug}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <div>
                  <Badge variant={store.status === "ACTIVE" ? "success" : store.status === "SUSPENDED" ? "destructive" : "outline"}>{capitalizeWord(store.status.toLowerCase())}</Badge>
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Created on</p>
                <p className="text-sm font-medium">{formatDate(store.createdAt, "LLL dd, y")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 @xl/main:grid-cols-3">
          {storeLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>

        <StoreActions store={store} />
      </div>
    </div>
  )
}

export default StoreOverviewPage
