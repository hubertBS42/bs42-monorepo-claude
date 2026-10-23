import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { capitalizeWord } from "@workspace/utils/text"
import { getNameInitials } from "@workspace/utils/name"
import { UserIcon, KeyRoundIcon, MonitorIcon, BellIcon, ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import {requireConsoleAccess} from "@/lib/auth-guard"
import { buttonVariants } from "@workspace/ui/components/button"

const overviewLinks = [
  {
    href: "/account/profile",
    icon: UserIcon,
    title: "Profile",
    description: "Update your name, email and avatar",
  },
  {
    href: "/account/password",
    icon: KeyRoundIcon,
    title: "Password",
    description: "Change your password",
  },
  {
    href: "/account/sessions",
    icon: MonitorIcon,
    title: "Sessions",
    description: "Manage your active devices and sessions",
  },
  {
    href: "/account/notifications",
    icon: BellIcon,
    title: "Notifications",
    description: "Choose the emails you get about your stores",
  },
]

const AccountPage = async () => {
  const {user} = await requireConsoleAccess()

  return (
    <div className="grid gap-6">
      {/* Profile summary */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="size-16">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-lg">{getNameInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">{user.name}</p>
              <Badge variant="outline">{capitalizeWord(user.role ?? "user")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {overviewLinks.map((link) => {
          const Icon = link.icon
          return (
            <Card key={link.href} className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  
                    <Link href={link.href} className={buttonVariants({variant: "ghost", size: "icon"})}>
                      <ArrowRightIcon className="size-4" />
                    </Link>
                 
                </div>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default AccountPage
