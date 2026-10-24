import { LoginForm } from "./_components/login-form"
import { prisma } from "@workspace/db"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Sign in",
}

type LoginPageProps = {
  searchParams: Promise<{ callbackURL?: string; setupComplete?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackURL, setupComplete } = await searchParams

  if ((await prisma.user.count()) === 0) {
    redirect("/setup")
  }

  return <LoginForm callbackURL={callbackURL ?? "/"} setupComplete={setupComplete === "1"} />
}
