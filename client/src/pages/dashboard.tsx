import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator, getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatPower, formatTemp, formatUptime, formatEfficiency } from "@/lib/format";
import { Link } from "wouter";
import {
  Activity,
  Cpu,
  Zap,
  Thermometer,
  Server,
  AlertTriangle,
  TrendingUp,
  Fan,
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
import type { FleetStats, MinerWithLatest } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<FleetStats>({
    queryKey: ["/api/fleet/stats"],
    refetchInterval: 5000,
  });

  const { data: miners, isLoading: minersLoading, error: minersError } = useQuery<MinerWithLatest[]>({
    queryKey: ["/api/miners"],
    refetchInterval: 5000,
  });

  const { data: history } = useQuery<Array<{ time: string; hashrate: number; power: number; temp: number }>>({
    queryKey: ["/api/fleet/history"],
    refetchInterval: 10000,
  });

  if (statsError || minersError) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load fleet data</p>
        <p className="text-xs text-muted-foreground">{(statsError || minersError)?.message}</p>
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
          value={stats ? `${stats.totalMiners}` : "--"}
          subtitle={stats ? `${stats.onlineMiners} online` : undefined}
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
          value={stats ? `${stats.activeAlerts}` : "--"}
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

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-medium">Miner Fleet</h3>
          <Link href="/miners" data-testid="link-view-all-miners">
            <span className="text-xs text-primary cursor-pointer">View all</span>
          </Link>
        </div>

        {minersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : miners && miners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {miners.map((miner) => (
              <MinerCard key={miner.id} miner={miner} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No miners configured yet</p>
              <Link href="/settings">
                <span className="text-xs text-primary cursor-pointer mt-1 inline-block">
                  Add your first miner
                </span>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MinerCard({ miner }: { miner: MinerWithLatest }) {
  const status = getMinerStatus(miner);
  const s = miner.latest;
  return (
    <Link href={`/miners/${miner.id}`}>
      <Card className="cursor-pointer hover-elevate transition-all" data-testid={`card-miner-${miner.id}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIndicator status={status} size="sm" />
              <span className="text-sm font-medium truncate">{miner.name}</span>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 no-default-active-elevate">
              {miner.model || "WhatsMiner"}
            </Badge>
          </div>

          {s ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <MetricRow icon={<Cpu className="w-3 h-3" />} label="Hashrate" value={formatHashrate(s.hashrate ?? 0)} />
              <MetricRow icon={<Thermometer className="w-3 h-3" />} label="Temp" value={formatTemp(s.temperature ?? 0)} />
              <MetricRow icon={<Zap className="w-3 h-3" />} label="Power" value={formatPower(s.power ?? 0)} />
              <MetricRow icon={<Fan className="w-3 h-3" />} label="Fan In" value={`${s.fanSpeedIn ?? 0} RPM`} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No data available</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 border-t">
            <span className="text-[10px] text-muted-foreground font-mono">{miner.ipAddress}:{miner.port}</span>
            {s && (
              <span className="text-[10px] text-muted-foreground">
                Up {formatUptime(s.elapsed ?? 0)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium ml-auto">{value}</span>
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
