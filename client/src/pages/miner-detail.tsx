import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusIndicator, getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatPower, formatTemp, formatUptime, formatEfficiency } from "@/lib/format";
import {
  ArrowLeft,
  Cpu,
  Zap,
  Thermometer,
  Fan,
  Clock,
  Activity,
  TrendingUp,
  Target,
  Gauge,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MinerWithLatest, MinerSnapshot } from "@shared/schema";

export default function MinerDetail() {
  const params = useParams<{ id: string }>();

  const { data: miner, isLoading } = useQuery<MinerWithLatest>({
    queryKey: ["/api/miners", params.id],
    refetchInterval: 5000,
  });

  const { data: history } = useQuery<MinerSnapshot[]>({
    queryKey: ["/api/miners", params.id, "history"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!miner) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Miner not found</p>
        <Link href="/miners">
          <Button variant="outline" size="sm" data-testid="button-back-miners">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Miners
          </Button>
        </Link>
      </div>
    );
  }

  const status = getMinerStatus(miner);
  const s = miner.latest;

  const chartData = history?.map((snap) => ({
    time: new Date(snap.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    hashrate: snap.hashrate ?? 0,
    temperature: snap.temperature ?? 0,
    power: snap.power ?? 0,
    fanIn: snap.fanSpeedIn ?? 0,
    fanOut: snap.fanSpeedOut ?? 0,
  })) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/miners">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} size="lg" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight" data-testid="text-miner-name">
              {miner.name}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              {miner.ipAddress}:{miner.port}
              {miner.location && ` / ${miner.location}`}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto no-default-active-elevate">
          {miner.model || "WhatsMiner"}
        </Badge>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <DetailStat
              icon={<Cpu className="w-4 h-4" />}
              label="Hashrate"
              value={formatHashrate(s.hashrate ?? 0)}
              accent
            />
            <DetailStat
              icon={<Thermometer className="w-4 h-4" />}
              label="Board Temp"
              value={formatTemp(s.temperature ?? 0)}
              sub={`Env: ${formatTemp(s.envTemp ?? 0)}`}
            />
            <DetailStat
              icon={<Zap className="w-4 h-4" />}
              label="Power"
              value={formatPower(s.power ?? 0)}
              sub={`Limit: ${formatPower(s.powerLimit ?? 3600)}`}
            />
            <DetailStat
              icon={<Fan className="w-4 h-4" />}
              label="Fans"
              value={`${s.fanSpeedIn ?? 0} / ${s.fanSpeedOut ?? 0}`}
              sub="In / Out RPM"
            />
            <DetailStat
              icon={<Clock className="w-4 h-4" />}
              label="Uptime"
              value={formatUptime(s.elapsed ?? 0)}
              sub={`Mode: ${s.powerMode ?? "Normal"}`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DetailStat
              icon={<TrendingUp className="w-4 h-4" />}
              label="Efficiency"
              value={formatEfficiency(s.hashrate ?? 0, s.power ?? 0)}
            />
            <DetailStat
              icon={<Target className="w-4 h-4" />}
              label="Freq"
              value={`${s.freqAvg ?? 0} / ${s.targetFreq ?? 0} MHz`}
              sub="Avg / Target"
            />
            <DetailStat
              icon={<Activity className="w-4 h-4" />}
              label="Accepted"
              value={`${s.accepted ?? 0}`}
              sub={`Rej: ${s.rejected ?? 0}`}
            />
            <DetailStat
              icon={<Gauge className="w-4 h-4" />}
              label="Factory GH/s"
              value={`${((s.factoryGhs ?? 0) / 1000).toFixed(0)} TH/s`}
            />
          </div>

          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Hashrate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 20%)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}T`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 22%, 12%)",
                            border: "1px solid hsl(222, 20%, 18%)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "hsl(220, 10%, 92%)",
                          }}
                          formatter={(v: number) => [formatHashrate(v), "Hashrate"]}
                        />
                        <Area type="monotone" dataKey="hashrate" stroke="hsl(35, 95%, 55%)" strokeWidth={2} fill="url(#hashGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Temperature & Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 20%)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}°`} />
                        <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}W`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 22%, 12%)",
                            border: "1px solid hsl(222, 20%, 18%)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "hsl(220, 10%, 92%)",
                          }}
                        />
                        <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="hsl(0, 84%, 55%)" strokeWidth={2} dot={false} />
                        <Line yAxisId="power" type="monotone" dataKey="power" stroke="hsl(200, 82%, 60%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No telemetry data available for this miner</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailStat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-base font-semibold font-mono tracking-tight ${accent ? "text-primary" : ""}`}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
