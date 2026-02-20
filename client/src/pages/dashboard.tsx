import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHashrate, formatPower, formatTemp } from "@/lib/format";
import { ContainerSummaryMap, type ContainerSummary } from "@/components/site-map";
import { AssignMinerDialog } from "@/components/assign-miner-dialog";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Cpu,
  Zap,
  Thermometer,
  Server,
  AlertTriangle,
  TrendingUp,
  Map,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FleetStats } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    containerId: string;
    rack: number;
    slot: number;
    mode: "assign" | "swap";
    currentMinerId?: string;
  }>({ open: false, containerId: "", rack: 0, slot: 0, mode: "assign" });

  const unassignMutation = useMutation({
    mutationFn: async ({ containerId, rack, slot }: { containerId: string; rack: number; slot: number }) => {
      await apiRequest("POST", `/api/containers/${containerId}/unassign`, { rack, slot });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      toast({ title: "Miner removed from slot" });
    },
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<FleetStats>({
    queryKey: ["/api/fleet/stats"],
    refetchInterval: 10000,
  });

  const { data: history } = useQuery<Array<{ time: string; hashrate: number; power: number; temp: number }>>({
    queryKey: ["/api/fleet/history"],
    refetchInterval: 30000,
  });

  const { data: containerSummaries, isLoading: containersLoading } = useQuery<ContainerSummary[]>({
    queryKey: ["/api/containers/summary"],
    refetchInterval: 10000,
  });

  const hasContainers = containerSummaries && containerSummaries.length > 0;

  if (statsError) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load fleet data</p>
        <p className="text-xs text-muted-foreground">{statsError?.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" data-testid="text-dashboard-title">
            Fleet Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of your mining fleet
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs no-default-active-elevate">
          <Activity className="w-3 h-3 mr-1 text-emerald-500 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Miners"
          value={stats ? stats.totalMiners.toLocaleString() : "--"}
          subtitle={stats ? `${stats.onlineMiners.toLocaleString()} online` : undefined}
          icon={<Server className="w-4 h-4" />}
          loading={statsLoading}
          testId="stat-total-miners"
        />
        <StatCard
          title="Total Hashrate"
          value={stats ? formatHashrate(stats.totalHashrate) : "--"}
          icon={<Cpu className="w-4 h-4" />}
          loading={statsLoading}
          accent
          testId="stat-hashrate"
        />
        <StatCard
          title="Total Power"
          value={stats ? formatPower(stats.totalPower) : "--"}
          icon={<Zap className="w-4 h-4" />}
          loading={statsLoading}
          testId="stat-power"
        />
        <StatCard
          title="Avg Temp"
          value={stats ? formatTemp(stats.avgTemperature) : "--"}
          icon={<Thermometer className="w-4 h-4" />}
          loading={statsLoading}
          testId="stat-temp"
        />
        <StatCard
          title="Avg Efficiency"
          value={stats ? `${stats.avgEfficiency.toFixed(1)} J/TH` : "--"}
          icon={<TrendingUp className="w-4 h-4" />}
          loading={statsLoading}
          testId="stat-efficiency"
        />
        <StatCard
          title="Active Alerts"
          value={stats ? stats.activeAlerts.toLocaleString() : "--"}
          icon={<AlertTriangle className="w-4 h-4" />}
          loading={statsLoading}
          destructive={stats ? stats.activeAlerts > 0 : false}
          testId="stat-alerts"
        />
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fleet Hashrate (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 20%)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}T`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 22%, 12%)",
                      border: "1px solid hsl(222, 20%, 18%)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "hsl(220, 10%, 92%)",
                    }}
                    labelStyle={{ color: "hsl(220, 10%, 55%)" }}
                    formatter={(value: number) => [formatHashrate(value), "Hashrate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="hashrate"
                    stroke="hsl(35, 95%, 55%)"
                    strokeWidth={2}
                    fill="url(#hashrateGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Map className="w-4 h-4" />
              Site Map
              {containerSummaries && (
                <Badge variant="outline" className="text-[10px] ml-1 no-default-active-elevate">
                  {containerSummaries.length} containers
                </Badge>
              )}
            </CardTitle>
            <Link href="/miners" data-testid="link-view-all-miners">
              <span className="text-xs text-primary cursor-pointer">View details</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {containersLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : hasContainers ? (
            <ContainerSummaryMap
              containers={containerSummaries}
              onAssignSlot={(cId, r, s) =>
                setAssignDialog({ open: true, containerId: cId, rack: r, slot: s, mode: "assign" })
              }
              onSwapSlot={(cId, r, s, minerId) =>
                setAssignDialog({ open: true, containerId: cId, rack: r, slot: s, mode: "swap", currentMinerId: minerId })
              }
              onUnassignSlot={(cId, r, s) => unassignMutation.mutate({ containerId: cId, rack: r, slot: s })}
            />
          ) : (
            <div className="text-center py-8">
              <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No containers configured</p>
              <Link href="/settings">
                <span className="text-xs text-primary cursor-pointer mt-1 inline-block">
                  Add containers in Settings
                </span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignMinerDialog
        open={assignDialog.open}
        onOpenChange={(o) => setAssignDialog((prev) => ({ ...prev, open: o }))}
        containerId={assignDialog.containerId}
        rack={assignDialog.rack}
        slot={assignDialog.slot}
        mode={assignDialog.mode}
        currentMinerId={assignDialog.currentMinerId}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  loading,
  accent,
  destructive,
  testId,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
  accent?: boolean;
  destructive?: boolean;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-muted-foreground">{icon}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</span>
            </div>
            <p
              className={`text-lg font-semibold font-mono tracking-tight ${
                accent ? "text-primary" : destructive ? "text-destructive" : ""
              }`}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
