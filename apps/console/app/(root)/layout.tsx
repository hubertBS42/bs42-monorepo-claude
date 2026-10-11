import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { ReactNode } from "react"

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col p-4 md:p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
