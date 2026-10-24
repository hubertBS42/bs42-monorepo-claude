"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { ChevronDown, FolderInput } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { Status } from "@workspace/db/enums"
import { CascaderField, type CascaderOption } from "@workspace/forms"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import FormDialog from "@/components/form-dialog"
import { moveProductsAction, setProductsStatusAction } from "@/lib/actions/product.actions"
import type { ProductListItem } from "@/types"

export interface CategoryChoices {
  options: CascaderOption[]
  disabledIds: string[]
}

const STATUS_CHOICES: { status: Status; label: string; verb: string; done: string; effect: string }[] = [
  { status: Status.PUBLISHED, label: "Published", verb: "Publish", done: "published", effect: "Customers can find them in every store that lists them and has them on sale." },
  { status: Status.DRAFT, label: "Draft", verb: "Move to draft", done: "moved to draft", effect: "Customers won't see them until they're published again." },
  { status: Status.ARCHIVED, label: "Archived", verb: "Archive", done: "archived", effect: "For products no longer sold: customers won't see them until they're published again." },
]

const moveSchema = z.object({ categoryId: z.string().min(1, "Choose a category") })

const countLabel = (count: number) => (count === 1 ? "1 product" : `${count} products`)

// For the products ticked in the table: set their status, or move them to another category. Checks the role itself;
// the actions check again.
export default function BulkProductActions({ products, categories, clear }: { products: ProductListItem[]; categories: CategoryChoices; clear: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<(typeof STATUS_CHOICES)[number] | null>(null)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isSessionLoading) return <Skeleton className="h-8 w-64 rounded-md" />

  // hasSystemPermission, not checkRolePermission: roles can be comma-separated
  if (!hasSystemPermission(session?.user.role, { product: ["update"] })) return <span className="text-xs text-muted-foreground">Your role can&apos;t change products.</span>

  const productIds = products.map((product) => product.id)
  const count = countLabel(products.length)

  const setStatus = (choice: (typeof STATUS_CHOICES)[number]) => {
    startTransition(async () => {
      const response = await setProductsStatusAction({ productIds, status: choice.status })
      if (!response.success) {
        // The dialog stays open, so the user can untick the ones named and try again
        toast.add({ title: `Couldn't ${choice.verb.toLowerCase()} them`, description: response.error, type: "error" })
        return
      }
      setConfirming(null)
      clear()
      toast.add({ title: `${count} ${choice.done}`, type: "success" })
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" size="sm" variant="outline" disabled={isPending}>
              Set status
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {STATUS_CHOICES.map((choice) => (
            <DropdownMenuItem key={choice.status} onClick={() => setConfirming(choice)}>
              {choice.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && `${confirming.verb} ${count}?`}</AlertDialogTitle>
            <AlertDialogDescription>{confirming?.effect}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (confirming) setStatus(confirming)
              }}
              disabled={isPending}
            >
              {isPending ? <Spinner /> : confirming?.verb}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormDialog
        trigger={
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            <FolderInput />
            Move to category
          </Button>
        }
        title={`Move ${count}`}
        description="Specifications the new category doesn't have are cleared."
        submitLabel="Move"
        failureTitle="Couldn't move them"
        refreshOn={[]}
        schema={moveSchema}
        values={{ categoryId: "" }}
        save={async ({ categoryId }) => {
          const response = await moveProductsAction({ productIds, categoryId })
          if (response.success) clear()
          return response
        }}
        success={() => ({ title: `${count} moved`, description: "Their specifications follow the new category." })}
      >
        {(form, saving) => (
          <CascaderField
            control={form.control}
            label="Category"
            name="categoryId"
            options={categories.options}
            disabledOptions={categories.disabledIds}
            leafOnly
            disabled={saving}
            placeholder="Select a category"
            description="Choose a category without subcategories."
          />
        )}
      </FormDialog>
    </>
  )
}
