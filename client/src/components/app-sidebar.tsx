import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Server,
  Bell,
  Settings,
  Activity,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { FleetStats } from "@shared/schema";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Miners", url: "/miners", icon: Server },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  const { data: stats } = useQuery<FleetStats>({
    queryKey: ["/api/fleet/stats"],
    refetchInterval: 5000,
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">WhatsMiner Pulse</h1>
            <p className="text-xs text-muted-foreground">Fleet Monitor</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location === "/"
                    : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.title === "Alerts" && stats && stats.activeAlerts > 0 && (
                          <Badge variant="destructive" className="ml-auto text-xs no-default-active-elevate">
                            {stats.activeAlerts}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Fleet Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Online</span>
                <span className="text-xs font-mono font-medium" data-testid="text-online-count">
                  {stats ? `${stats.onlineMiners}/${stats.totalMiners}` : "--/--"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Hashrate</span>
                <span className="text-xs font-mono font-medium" data-testid="text-sidebar-hashrate">
                  {stats ? formatHashrate(stats.totalHashrate) : "-- TH/s"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Power</span>
                <span className="text-xs font-mono font-medium" data-testid="text-sidebar-power">
                  {stats ? `${(stats.totalPower / 1000).toFixed(1)} kW` : "-- kW"}
                </span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live polling active</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function formatHashrate(ghs: number): string {
  if (ghs >= 1000000) return `${(ghs / 1000000).toFixed(1)} PH/s`;
  if (ghs >= 1000) return `${(ghs / 1000).toFixed(1)} TH/s`;
  return `${ghs.toFixed(1)} GH/s`;
}
