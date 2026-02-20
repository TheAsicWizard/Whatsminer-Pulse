import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatTemp, formatPower } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Box, Server, Cpu, Zap, Thermometer, Settings } from "lucide-react";
import type { MinerWithLatest, ContainerWithSlots, Container } from "@shared/schema";
import { cn } from "@/lib/utils";

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  online: {
    bg: "bg-emerald-500",
    border: "border-emerald-400",
    text: "text-emerald-950",
  },
  warning: {
    bg: "bg-amber-400",
    border: "border-amber-300",
    text: "text-amber-950",
  },
  critical: {
    bg: "bg-red-500",
    border: "border-red-400",
    text: "text-red-950",
  },
  offline: {
    bg: "bg-gray-400 dark:bg-gray-600",
    border: "border-gray-300 dark:border-gray-500",
    text: "text-gray-900 dark:text-gray-200",
  },
};

export type ContainerSummary = Container & {
  onlineCount: number;
  warningCount: number;
  criticalCount: number;
  offlineCount: number;
  totalAssigned: number;
  totalHashrate: number;
  totalPower: number;
  avgTemp: number;
};

interface SiteMapProps {
  miners: MinerWithLatest[];
  columns?: number;
}

export function SiteMap({ miners, columns }: SiteMapProps) {
  const sorted = [...miners].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const statusCounts = {
    online: sorted.filter((m) => getMinerStatus(m) === "online").length,
    warning: sorted.filter((m) => getMinerStatus(m) === "warning").length,
    critical: sorted.filter((m) => getMinerStatus(m) === "critical").length,
    offline: sorted.filter((m) => getMinerStatus(m) === "offline").length,
  };

  const cols = columns || (sorted.length > 200 ? 20 : sorted.length > 100 ? 15 : sorted.length > 50 ? 10 : 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <LegendItem color="bg-emerald-500" label="Online" count={statusCounts.online} />
        <LegendItem color="bg-amber-400" label="Warning" count={statusCounts.warning} />
        <LegendItem color="bg-red-500" label="Critical" count={statusCounts.critical} />
        <LegendItem color="bg-gray-400 dark:bg-gray-600" label="Offline" count={statusCounts.offline} />
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        data-testid="site-map-grid"
      >
        {sorted.map((miner) => (
          <MinerBlock key={miner.id} miner={miner} />
        ))}
      </div>
    </div>
  );
}

interface ContainerSummaryMapProps {
  containers: ContainerSummary[];
  onAssignSlot?: (containerId: string, rack: number, slot: number) => void;
  onSwapSlot?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onUnassignSlot?: (containerId: string, rack: number, slot: number) => void;
}

export function ContainerSummaryMap({ containers, onAssignSlot, onSwapSlot, onUnassignSlot }: ContainerSummaryMapProps) {
  if (!containers || containers.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Box className="w-10 h-10 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No containers configured</p>
        <p className="text-xs text-muted-foreground">Add containers in Settings to organize your miners by physical location</p>
      </div>
    );
  }

  const totals = containers.reduce(
    (acc, c) => ({
      online: acc.online + c.onlineCount,
      warning: acc.warning + c.warningCount,
      critical: acc.critical + c.criticalCount,
      offline: acc.offline + c.offlineCount,
      empty: acc.empty + (c.rackCount * c.slotsPerRack - c.totalAssigned),
    }),
    { online: 0, warning: 0, critical: 0, offline: 0, empty: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <LegendItem color="bg-emerald-500" label="Online" count={totals.online} />
        <LegendItem color="bg-amber-400" label="Warning" count={totals.warning} />
        <LegendItem color="bg-red-500" label="Critical" count={totals.critical} />
        <LegendItem color="bg-gray-400 dark:bg-gray-600" label="Offline" count={totals.offline} />
        <LegendItem color="bg-muted/50 border border-dashed border-muted-foreground/30" label="Empty" count={totals.empty} />
      </div>

      <div className="space-y-2">
        {containers.map((container) => (
          <ContainerSummaryCard
            key={container.id}
            container={container}
            onAssignSlot={onAssignSlot}
            onSwapSlot={onSwapSlot}
            onUnassignSlot={onUnassignSlot}
          />
        ))}
      </div>
    </div>
  );
}

function ContainerSummaryCard({
  container,
  onAssignSlot,
  onSwapSlot,
  onUnassignSlot,
}: {
  container: ContainerSummary;
  onAssignSlot?: (containerId: string, rack: number, slot: number) => void;
  onSwapSlot?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onUnassignSlot?: (containerId: string, rack: number, slot: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalSlots = container.rackCount * container.slotsPerRack;
  const healthPct = container.totalAssigned > 0
    ? ((container.onlineCount / container.totalAssigned) * 100)
    : 0;

  const healthColor = healthPct >= 95
    ? "text-emerald-500"
    : healthPct >= 80
    ? "text-amber-400"
    : "text-red-500";

  return (
    <Card data-testid={`container-card-${container.id}`}>
      <CardHeader
        className="pb-2 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Box className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{container.name}</CardTitle>
            <Badge variant="outline" className="text-[10px] no-default-active-elevate">
              {container.totalAssigned}/{totalSlots} slots
            </Badge>
            {container.criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {container.criticalCount} critical
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className={cn("flex items-center gap-1 font-mono", healthColor)}>
              <Server className="w-3 h-3" />
              {container.onlineCount}/{container.totalAssigned}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Cpu className="w-3 h-3" />
              <span className="font-mono">{formatHashrate(container.totalHashrate)}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span className="font-mono">{formatPower(container.totalPower)}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Thermometer className="w-3 h-3" />
              <span className="font-mono">{formatTemp(container.avgTemp)}</span>
            </span>
          </div>
        </div>

        {!expanded && (
          <div className="flex gap-[2px] mt-2 h-2">
            {container.onlineCount > 0 && (
              <div
                className="bg-emerald-500 rounded-sm"
                style={{ flex: container.onlineCount }}
              />
            )}
            {container.warningCount > 0 && (
              <div
                className="bg-amber-400 rounded-sm"
                style={{ flex: container.warningCount }}
              />
            )}
            {container.criticalCount > 0 && (
              <div
                className="bg-red-500 rounded-sm"
                style={{ flex: container.criticalCount }}
              />
            )}
            {container.offlineCount > 0 && (
              <div
                className="bg-gray-500 rounded-sm"
                style={{ flex: container.offlineCount }}
              />
            )}
            {totalSlots - container.totalAssigned > 0 && (
              <div
                className="bg-muted/50 rounded-sm"
                style={{ flex: totalSlots - container.totalAssigned }}
              />
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <ContainerDetailView
          containerId={container.id}
          container={container}
          onAssignSlot={onAssignSlot}
          onSwapSlot={onSwapSlot}
          onUnassignSlot={onUnassignSlot}
        />
      )}
    </Card>
  );
}

function ContainerDetailView({
  containerId,
  container,
  onAssignSlot,
  onSwapSlot,
  onUnassignSlot,
}: {
  containerId: string;
  container: ContainerSummary;
  onAssignSlot?: (containerId: string, rack: number, slot: number) => void;
  onSwapSlot?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onUnassignSlot?: (containerId: string, rack: number, slot: number) => void;
}) {
  const { data: detail, isLoading } = useQuery<ContainerWithSlots>({
    queryKey: ["/api/containers", containerId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/containers/${containerId}/detail`);
      if (!res.ok) throw new Error("Failed to load container details");
      return res.json();
    },
    refetchInterval: 10000,
  });

  if (isLoading || !detail) {
    return (
      <CardContent className="pb-3">
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] w-[80px] shrink-0" />
          ))}
        </div>
      </CardContent>
    );
  }

  const slotMap = new Map<string, ContainerWithSlots["slots"][0]>();
  for (const s of detail.slots) {
    slotMap.set(`${s.rack}-${s.slot}`, s);
  }

  const slotsPerCol = Math.ceil(container.slotsPerRack / 2);

  return (
    <CardContent className="pb-3">
      <div
        className="rounded-lg p-3 overflow-x-auto"
        style={{ backgroundColor: "#005500" }}
        data-testid={`container-rack-view-${containerId}`}
      >
        <div className="flex gap-2 min-w-max">
          {Array.from({ length: container.rackCount }, (_, rIdx) => {
            const rackNum = rIdx + 1;
            const rackLabel = `${container.name}-R${String(rackNum).padStart(3, "0")}`;

            return (
              <div
                key={rackNum}
                className="flex flex-col rounded"
                style={{ backgroundColor: "#003300", minWidth: "70px" }}
              >
                <div className="flex items-center justify-between px-1.5 py-1 border-b" style={{ borderColor: "#006600" }}>
                  <span className="text-[9px] font-mono text-green-200 truncate">{rackLabel}</span>
                  <Settings className="w-2.5 h-2.5 text-green-400/60 shrink-0" />
                </div>
                <div className="flex gap-[3px] p-1.5 flex-1">
                  <div className="flex flex-col gap-[3px]">
                    {Array.from({ length: slotsPerCol }, (_, sIdx) => {
                      const slotNum = sIdx + 1;
                      const assignment = slotMap.get(`${rackNum}-${slotNum}`);
                      const miner = assignment?.miner;
                      if (!miner) return null;
                      return (
                        <RackSlot
                          key={`${rackNum}-${slotNum}`}
                          miner={miner}
                          containerId={containerId}
                          rackNum={rackNum}
                          slotNum={slotNum}
                          onSwap={onSwapSlot}
                          onRemove={onUnassignSlot}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    {Array.from({ length: container.slotsPerRack - slotsPerCol }, (_, sIdx) => {
                      const slotNum = slotsPerCol + sIdx + 1;
                      const assignment = slotMap.get(`${rackNum}-${slotNum}`);
                      const miner = assignment?.miner;
                      if (!miner) return null;
                      return (
                        <RackSlot
                          key={`${rackNum}-${slotNum}`}
                          miner={miner}
                          containerId={containerId}
                          rackNum={rackNum}
                          slotNum={slotNum}
                          onSwap={onSwapSlot}
                          onRemove={onUnassignSlot}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CardContent>
  );
}

function RackSlot({
  miner,
  containerId,
  rackNum,
  slotNum,
  onSwap,
  onRemove,
}: {
  miner: MinerWithLatest;
  containerId: string;
  rackNum: number;
  slotNum: number;
  onSwap?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onRemove?: (containerId: string, rack: number, slot: number) => void;
}) {
  const status = getMinerStatus(miner);
  const s = miner.latest;

  const colorMap: Record<string, string> = {
    online: "#22c55e",
    warning: "#f59e0b",
    critical: "#ef4444",
    offline: "#6b7280",
  };

  const bgColor = colorMap[status] || colorMap.offline;
  const borderColor = status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "transparent";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/miners/${miner.id}`}>
          <div
            className="rounded-sm cursor-pointer transition-all hover:brightness-125 hover:scale-110 hover:z-10"
            style={{
              width: "28px",
              height: "18px",
              backgroundColor: bgColor,
              border: status === "critical" || status === "warning" ? `1.5px solid ${borderColor}` : "none",
              boxShadow: status === "online" ? "0 0 3px rgba(34,197,94,0.3)" : "none",
            }}
            data-testid={`rack-slot-${miner.id}`}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{miner.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{miner.ipAddress}</p>
          <p className="text-[10px] text-muted-foreground">R{String(rackNum).padStart(2, "0")}-S{String(slotNum).padStart(2, "0")}</p>
          {s ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t">
              <span className="text-[10px] text-muted-foreground">Hashrate</span>
              <span className="text-[10px] font-mono text-right">{formatHashrate(s.hashrate ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Temp</span>
              <span className="text-[10px] font-mono text-right">{formatTemp(s.temperature ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Power</span>
              <span className="text-[10px] font-mono text-right">{formatPower(s.power ?? 0)}</span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground pt-1">No data</p>
          )}
          {(onSwap || onRemove) && (
            <div className="flex gap-1 pt-1 border-t">
              {onSwap && (
                <Button variant="outline" size="sm" className="text-[10px] h-5 px-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSwap(containerId, rackNum, slotNum, miner.id); }}>
                  Replace
                </Button>
              )}
              {onRemove && (
                <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(containerId, rackNum, slotNum); }}>
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}


function MinerBlock({ miner, compact }: { miner: MinerWithLatest; compact?: boolean }) {
  const status = getMinerStatus(miner);
  const colors = statusColors[status] || statusColors.offline;
  const label = getMinerLabel(miner);
  const s = miner.latest;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/miners/${miner.id}`}>
          <div
            className={cn(
              "flex items-center justify-center rounded cursor-pointer border transition-all",
              "text-[9px] font-bold font-mono leading-none select-none",
              compact ? "h-6" : "h-7",
              "min-w-0",
              "hover:brightness-110 hover:z-10",
              colors.bg,
              colors.border,
              colors.text
            )}
            data-testid={`sitemap-block-${miner.id}`}
          >
            {label}
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{miner.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{miner.ipAddress}</p>
          {s ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t">
              <span className="text-[10px] text-muted-foreground">Hashrate</span>
              <span className="text-[10px] font-mono text-right">{formatHashrate(s.hashrate ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Temp</span>
              <span className="text-[10px] font-mono text-right">{formatTemp(s.temperature ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Power</span>
              <span className="text-[10px] font-mono text-right">{formatPower(s.power ?? 0)}</span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground pt-1">No data</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function getMinerLabel(miner: MinerWithLatest): string {
  const name = miner.name;
  if (name.length <= 8) return name;
  const parts = name.match(/\d+/);
  if (parts) return parts[0];
  return name.slice(0, 6);
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-3 h-3 rounded-sm", color)} />
      <span className="text-xs text-muted-foreground">
        {label}: <span className="font-mono font-medium">{count.toLocaleString()}</span>
      </span>
    </div>
  );
}
