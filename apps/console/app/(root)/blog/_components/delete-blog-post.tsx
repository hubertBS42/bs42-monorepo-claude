"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"
import { deleteBlogPostAction } from "@/lib/actions/blog.actions"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { useRouter } from "next/navigation"

export default function DeleteBlogPost({ post }: { post: { id: string; title: string } }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isSessionLoading) return <Skeleton className="h-9 rounded-md sm:w-40" />

  // hasSystemPermission, not checkRolePermission: roles can be comma-separated. deleteBlogPostAction checks again on the server.
  const canDelete = hasSystemPermission(session?.user.role, { blogPost: ["delete"] })

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteBlogPostAction(post.id)

      if (!response.success) {
        // The dialog stays open so the user can retry or cancel on purpose
        toast.add({ title: "Operation failed", description: response.error, type: "error" })
        return
      }

      setIsOpen(false)
      toast.add({ title: "Post deleted", description: `${post.title} has been deleted.`, type: "success" })
      router.push("/blog")
    })
  }

  return (
    <div className="grid gap-2 sm:justify-items-start">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full sm:w-auto" variant="destructive" disabled={!canDelete}>
              Delete Post
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This can't be undone. ${post.title} will be permanently deleted, and its link will stop working.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={isPending}
            >
              {isPending ? <Spinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown as text because a disabled button never shows its title tooltip, and screen readers skip it */}
      {!canDelete && <p className="text-xs text-muted-foreground">Your role cannot delete posts.</p>}
    </div>
  )
}
