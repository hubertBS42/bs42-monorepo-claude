/* eslint-disable @next/next/no-img-element */
import { SetupForm } from "./_components/setup-form"
import { prisma } from "@workspace/db"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Set up your administrator account",
}

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) {
    redirect("/login")
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/30 px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-primary/10 to-transparent" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <img src="/images/logo.png" alt="BS42.NET logo" className="h-14 w-auto max-w-25 object-contain" />
            </div>

            <div className="mb-4 text-xs font-semibold tracking-[0.2em] text-primary-foreground/70 uppercase">Welcome</div>
            <h1 className="max-w-sm text-2xl leading-tight font-semibold tracking-tight">Set up your platform.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/75">
              Create your administrator account to start managing the platform.
            </p>
          </div>

          <div className="space-y-4 text-sm text-primary-foreground/80">
            <div className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground text-xs font-semibold text-primary">1</span>
              Create your account
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-semibold text-primary-foreground">
                2
              </span>
              Start managing the platform
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <img src="/images/logo.png" alt="BS42.NET logo" className="h-10 w-auto max-w-35 object-contain" />
          </div>
          <SetupForm />
        </div>
      </div>
    </main>
  )
}
