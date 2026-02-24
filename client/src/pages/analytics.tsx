import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHashrate, formatPower } from "@/lib/format";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Server,
  Activity,
  Cpu,
  Zap,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface FleetAnalytics {
  costPerKwh: number;
  currency: string;
  totalPowerKw: number;
  dailyCost: number;
  monthlyCost: number;
  totalHashrateTh: number;
  avgEfficiency: number;
  totalMiners: number;
  onlineMiners: number;
  hashrateDistribution: Array<{ range: string; count: number }>;
  tempDistribution: Array<{ range: string; count: number }>;
  modelDistribution: Array<{ model: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

interface FleetHistoryPoint {
  time: string;
  hashrate: number;
  power: number;
  temp: number;
}

const STATUS_COLORS: Record<string, string> = {
  online: "hsl(152, 69%, 45%)",
  critical: "hsl(0, 84%, 55%)",
  warning: "hsl(35, 95%, 55%)",
  offline: "hsl(220, 10%, 45%)",
};

const PIE_COLORS = [
  "hsl(35, 95%, 55%)",
  "hsl(200, 82%, 60%)",
  "hsl(152, 69%, 45%)",
  "hsl(0, 84%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(45, 90%, 50%)",
  "hsl(170, 60%, 50%)",
  "hsl(320, 70%, 55%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(222, 22%, 12%)",
  border: "1px solid hsl(222, 20%, 18%)",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(220, 10%, 92%)",
};

const axisTickStyle = { fontSize: 10, fill: "hsl(220, 10%, 55%)" };
const gridStroke = "hsl(222, 15%, 20%)";

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<FleetAnalytics>({
    queryKey: ["/api/fleet/analytics"],
    refetchInterval: 30000,
  });

  const { data: history } = useQuery<FleetHistoryPoint[]>({
    queryKey: ["/api/fleet/history"],
    refetchInterval: 30000,
  });

  const onlineRate = analytics
    ? analytics.totalMiners > 0
      ? ((analytics.onlineMiners / analytics.totalMiners) * 100).toFixed(1)
      : "0.0"
    : "--";

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2
            className="text-xl font-semibold tracking-tight"
            data-testid="text-analytics-title"
          >
            Fleet Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Performance metrics and cost analysis
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
          value={analytics ? analytics.totalMiners.toLocaleString() : "--"}
          icon={<Server className="w-4 h-4" />}
          loading={isLoading}
          testId="stat-total-miners"
        />
        <StatCard
          title="Online Rate"
          value={onlineRate !== "--" ? `${onlineRate}%` : "--"}
          subtitle={analytics ? `${analytics.onlineMiners} online` : undefined}
          icon={<Activity className="w-4 h-4" />}
          loading={isLoading}
          accent
          testId="stat-online-rate"
        />
        <StatCard
          title="Total Hashrate"
          value={analytics ? formatHashrate(analytics.totalHashrateTh * 1000) : "--"}
          icon={<Cpu className="w-4 h-4" />}
          loading={isLoading}
          accent
          testId="stat-hashrate"
        />
        <StatCard
          title="Total Power"
          value={analytics ? `${analytics.totalPowerKw.toFixed(1)} kW` : "--"}
          icon={<Zap className="w-4 h-4" />}
          loading={isLoading}
          testId="stat-power"
        />
        <StatCard
          title="Daily Cost"
          value={
            analytics
              ? `${analytics.currency}${analytics.dailyCost.toFixed(2)}`
              : "--"
          }
          icon={<DollarSign className="w-4 h-4" />}
          loading={isLoading}
          testId="stat-daily-cost"
        />
        <StatCard
          title="Monthly Cost"
          value={
            analytics
              ? `${analytics.currency}${analytics.monthlyCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : "--"
          }
          icon={<TrendingUp className="w-4 h-4" />}
          loading={isLoading}
          testId="stat-monthly-cost"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-hashrate-distribution">
              Hashrate Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : analytics?.hashrateDistribution && analytics.hashrateDistribution.length > 0 ? (
              <div className="h-[250px]" data-testid="chart-hashrate-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.hashrateDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="range"
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(220, 10%, 55%)" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(35, 95%, 55%)"
                      radius={[4, 4, 0, 0]}
                      name="Miners"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-temp-distribution">
              Temperature Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : analytics?.tempDistribution && analytics.tempDistribution.length > 0 ? (
              <div className="h-[250px]" data-testid="chart-temp-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.tempDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="range"
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={axisTickStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(220, 10%, 55%)" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(0, 84%, 55%)"
                      radius={[4, 4, 0, 0]}
                      name="Miners"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-model-distribution">
              Model Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : analytics?.modelDistribution && analytics.modelDistribution.length > 0 ? (
              <div className="h-[280px]" data-testid="chart-model-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.modelDistribution}
                      dataKey="count"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ model, count }) => `${model} (${count})`}
                      labelLine={false}
                    >
                      {analytics.modelDistribution.map((_, index) => (
                        <Cell
                          key={`model-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "hsl(220, 10%, 55%)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-status-distribution">
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : analytics?.statusDistribution && analytics.statusDistribution.length > 0 ? (
              <div className="h-[280px]" data-testid="chart-status-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ status, count }) => `${status} (${count})`}
                      labelLine={false}
                    >
                      {analytics.statusDistribution.map((entry) => (
                        <Cell
                          key={`status-${entry.status}`}
                          fill={STATUS_COLORS[entry.status] || "hsl(220, 10%, 45%)"}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "hsl(220, 10%, 55%)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-fleet-history">
              Fleet History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]" data-testid="chart-fleet-history">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="time"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="hashrate"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}T`}
                  />
                  <YAxis
                    yAxisId="power"
                    orientation="right"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}kW`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "hsl(220, 10%, 55%)" }}
                    formatter={(value: number, name: string) => {
                      if (name === "hashrate") return [formatHashrate(value), "Hashrate"];
                      if (name === "power") return [formatPower(value), "Power"];
                      return [`${value}°C`, "Temp"];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "hsl(220, 10%, 55%)" }}
                  />
                  <Line
                    yAxisId="hashrate"
                    type="monotone"
                    dataKey="hashrate"
                    stroke="hsl(35, 95%, 55%)"
                    strokeWidth={2}
                    dot={false}
                    name="Hashrate"
                  />
                  <Line
                    yAxisId="power"
                    type="monotone"
                    dataKey="power"
                    stroke="hsl(200, 82%, 60%)"
                    strokeWidth={2}
                    dot={false}
                    name="Power"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
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
  testId,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
  accent?: boolean;
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
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {title}
              </span>
            </div>
            <p
              className={`text-lg font-semibold font-mono tracking-tight ${
                accent ? "text-primary" : ""
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
