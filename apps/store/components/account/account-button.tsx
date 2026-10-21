"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogIn, LogOut, PackageSearch, UserPlus, UserRound } from "lucide-react"
import { storeAuthClient } from "@workspace/auth/store-client"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { getNameInitials } from "@workspace/utils/name"

import { refreshBasketCount } from "@/components/basket/basket-count"
import { signInHref } from "@/lib/auth-redirect"

// The header's account menu. Pages are cached and shared, so the session is read in the browser.
export function AccountButton() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = storeAuthClient.useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  // Same size as the button, so the header doesn't shift when the session arrives
  if (isPending) return <div className="size-9 animate-pulse rounded-full bg-muted" aria-hidden />

  if (!session) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account" />}>
          <UserRound className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-52" align="end" sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLinkItem render={<Link href={signInHref("/sign-in", pathname)} />}>
              <LogIn aria-hidden />
              Sign in
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem render={<Link href={signInHref("/sign-up", pathname)} />}>
              <UserPlus aria-hidden />
              Create an account
            </DropdownMenuLinkItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLinkItem render={<Link href="/orders/find" />}>
            <PackageSearch aria-hidden />
            Find an order
          </DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const { name, email, image } = session.user

  async function signOut() {
    setIsSigningOut(true)
    setSignOutError(null)
    try {
      const result = await storeAuthClient.signOut()
      if (result.error) {
        setSignOutError("Unable to sign out. Please try again.")
        return
      }
      // The basket was the account's: a signed-out visitor starts a new one
      void refreshBasketCount()
      router.refresh()
    } catch (error) {
      console.error("Storefront sign-out failed:", error)
      setSignOutError("Unable to sign out. Please try again.")
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account: ${name}`} />}>
        <Avatar className="size-8">
          <AvatarImage src={image ?? undefined} alt="" />
          <AvatarFallback className="text-xs">{getNameInitials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="grid text-sm leading-tight">
              <span className="truncate font-medium text-foreground">{name}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {signOutError && (
          <p role="alert" className="px-2 py-1 text-sm text-destructive">
            {signOutError}
          </p>
        )}
        <DropdownMenuItem disabled={isSigningOut} closeOnClick={false} onClick={() => void signOut()}>
          <LogOut aria-hidden />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
