"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  CalendarRange,
  Users,
  Settings,
  LogOut,
  ChevronsUpDown,
  Zap,
} from "lucide-react";

import { cn, formatCurrencyCompact, initials } from "@/lib/utils";
import { useProfile } from "@/lib/profile-context";
import { useMonthSummary } from "@/lib/hooks/use-month-summary";
import { createClient } from "@/lib/supabase/client";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/income", label: "Income", icon: Wallet },
  { href: "/planner", label: "Planner", icon: CalendarRange },
  { href: "/shared", label: "Shared", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfileId } = useProfile();
  const summary = useMonthSummary(activeProfileId);
  const supabase = React.useMemo(() => createClient(), []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wallet className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">SpendSlip</span>
      </div>

      <ProfileSwitcher />

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-secondary hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2.5 py-2 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">This month</span>
            <span className="font-semibold text-foreground">
              {summary.loading ? "—" : formatCurrencyCompact(summary.monthTotal)}
            </span>
          </div>
          {summary.otStatus && (
            <Badge
              variant={summary.otStatus.covered ? "success" : "warning"}
              className="gap-1"
              title={
                summary.otStatus.covered
                  ? "Income covers this month's bills"
                  : `${summary.otStatus.hoursNeeded.toFixed(1)}h OT needed`
              }
            >
              <Zap className="size-3" />
              {summary.otStatus.covered ? "Covered" : `${summary.otStatus.hoursNeeded.toFixed(1)}h OT`}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-secondary">
                <Avatar className="size-7">
                  <AvatarFallback>{initials(userEmail || "U")}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{userEmail}</span>
                <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
