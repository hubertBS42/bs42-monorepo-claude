"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@workspace/ui/components/sidebar"
import { ChevronsUpDownIcon, SparklesIcon, BadgeCheckIcon, CreditCardIcon, BellIcon, LogOutIcon } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { useSignOut } from "@/hooks/use-sign-out"
import { getNameInitials } from "@workspace/utils/name"

interface UserSummaryProps {
  name: string
  email: string
  image?: string | null
}

function UserSummary({ name, email, image }: UserSummaryProps) {
  return (
    <>
      <Avatar>
        <AvatarImage src={image ?? undefined} alt={name} />
        <AvatarFallback>{getNameInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs">{email}</span>
      </div>
    </>
  )
}

// Same height as the real button, so the footer doesn't shift when the session arrives
function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 items-center gap-2 p-2" aria-hidden="true">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="grid flex-1 gap-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { data: session, isPending } = consoleAuthClient.useSession()
  const { signOut, isSigningOut, signOutError } = useSignOut()

  if (isPending) return <NavUserSkeleton />
  if (!session) return null

  const { name, email, image } = session.user

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            <UserSummary name={name} email={email} image={image} />
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? "bottom" : "top"} align="end" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserSummary name={name} email={email} image={image} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <SparklesIcon />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheckIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {signOutError && (
              <p role="alert" className="px-2 py-1 text-sm text-destructive">
                {signOutError}
              </p>
            )}
            <DropdownMenuItem disabled={isSigningOut} closeOnClick={false} onClick={() => void signOut()}>
              <LogOutIcon aria-hidden="true" />
              {isSigningOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
