import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { NavbarSystemHealthBadge } from "@/components/dashboard/navbar-health-badge";
import { Camera, Bell } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/sign-in?redirectTo=/dashboard");
  }

  // Fetch live unresolved alerts count for top navbar notification bell
  const unresolvedAlertsCount = await prisma.alert.count({
    where: { resolved: false },
  });

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role: session.user.role || "USER",
  };

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AdminSidebar user={user} />

          <SidebarInset className="flex flex-col flex-1 bg-background min-w-0">
            {/* Top Navbar Header aligned seamlessly at h-14 with Sidebar Header */}
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-3 sm:px-4 md:px-6 backdrop-blur-md">
              {/* Left Section: Sidebar Toggle + Breadcrumb */}
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="text-muted-foreground/70">IntelliGuard</span>
                  <span className="text-border">/</span>
                  <span className="text-foreground font-medium">Admin System</span>
                </div>
              </div>

              {/* Center Section: Real-Time AI Engine Status Badge */}
              <NavbarSystemHealthBadge />

              {/* Right Section: Quick Live Scan Button + Alerts Bell */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Live Webcam Scan Quick Button */}
                <Link
                  href="/dashboard/simulation"
                  className="px-2.5 sm:px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Live Scan</span>
                </Link>

                {/* Security Alerts Notification Bell */}
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <Link href="/dashboard/alerts" title="Security Alerts">
                    <Bell className="w-4 h-4" />
                    {unresolvedAlertsCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold font-mono text-destructive-foreground ring-2 ring-background">
                        {unresolvedAlertsCount > 9 ? "9+" : unresolvedAlertsCount}
                      </span>
                    )}
                  </Link>
                </Button>
              </div>
            </header>

            {/* Main Page Content */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
