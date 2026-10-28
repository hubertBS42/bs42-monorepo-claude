"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { fetchTodaysExchangeRateAction } from "@/lib/actions/exchange-rate.actions"

// Fetches today's rate from Open Exchange Rates now, as the daily job would: on the dashboard's rate check and in
// Settings while today has none. Only for those who can set the rate (superAdmins); others see nothing, since the
// places it sits already say who can change the rate.
export default function FetchRateButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isSessionLoading) return <Skeleton className="h-8 w-36 rounded-md" />
  if (!hasSystemPermission(session?.user.role, { appSettings: ["update"] })) return null

  const fetchRate = () => {
    startTransition(async () => {
      const response = await fetchTodaysExchangeRateAction()
      if (!response.success) {
        toast.add({ title: "Unable to fetch today's rate", description: response.error, type: "error" })
        return
      }
      const { status, rate } = response.data
      toast.add({
        title: status === "saved" ? "Exchange rate fetched" : "Today already has a rate",
        description: `Today's rate is GH₵${Number(rate)} per $1.`,
        type: "success",
      })
      router.refresh()
    })
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={fetchRate} disabled={isPending}>
      {isPending ? <Spinner /> : <RefreshCw />}
      Fetch today&apos;s rate
    </Button>
  )
}
