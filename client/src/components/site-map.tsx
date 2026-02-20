import { useState } from "react";
import { Link } from "wouter";
import { getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatTemp, formatPower } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Box, Server, Cpu, Zap, Thermometer } from "lucide-react";
import type { MinerWithLatest, ContainerWithSlots } from "@shared/schema";
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

const emptySlotStyle = {
  bg: "bg-muted/50",
  border: "border-dashed border-muted-foreground/30",
  text: "text-muted-foreground/50",
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

interface ContainerSiteMapProps {
  containers: ContainerWithSlots[];
  unassignedMiners?: MinerWithLatest[];
  onAssignSlot?: (containerId: string, rack: number, slot: number) => void;
  onSwapSlot?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onUnassignSlot?: (containerId: string, rack: number, slot: number) => void;
}

export function ContainerSiteMap({ containers: containerList, unassignedMiners, onAssignSlot, onSwapSlot, onUnassignSlot }: ContainerSiteMapProps) {
  if (!containerList || containerList.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Box className="w-10 h-10 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No containers configured</p>
        <p className="text-xs text-muted-foreground">Add containers in Settings to organize your miners by physical location</p>
      </div>
    );
  }

  const allMiners = containerList.flatMap((c) => c.slots.filter((s) => s.miner).map((s) => s.miner!));
  const statusCounts = {
    online: allMiners.filter((m) => getMinerStatus(m) === "online").length,
    warning: allMiners.filter((m) => getMinerStatus(m) === "warning").length,
    critical: allMiners.filter((m) => getMinerStatus(m) === "critical").length,
    offline: allMiners.filter((m) => getMinerStatus(m) === "offline").length,
    empty: containerList.reduce((sum, c) => sum + (c.rackCount * c.slotsPerRack) - c.slots.filter((s) => s.minerId).length, 0),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <LegendItem color="bg-emerald-500" label="Online" count={statusCounts.online} />
        <LegendItem color="bg-amber-400" label="Warning" count={statusCounts.warning} />
        <LegendItem color="bg-red-500" label="Critical" count={statusCounts.critical} />
        <LegendItem color="bg-gray-400 dark:bg-gray-600" label="Offline" count={statusCounts.offline} />
        <LegendItem color="bg-muted/50 border border-dashed border-muted-foreground/30" label="Empty" count={statusCounts.empty} />
      </div>

      <div className="space-y-3">
        {containerList.map((container) => (
          <ContainerCard
            key={container.id}
            container={container}
            onAssignSlot={onAssignSlot}
            onSwapSlot={onSwapSlot}
            onUnassignSlot={onUnassignSlot}
          />
        ))}
      </div>

      {unassignedMiners && unassignedMiners.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Server className="w-3.5 h-3.5" />
              Unassigned Miners ({unassignedMiners.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
              {unassignedMiners.map((miner) => (
                <MinerBlock key={miner.id} miner={miner} compact />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContainerCard({
  container,
  onAssignSlot,
  onSwapSlot,
  onUnassignSlot,
}: {
  container: ContainerWithSlots;
  onAssignSlot?: (containerId: string, rack: number, slot: number) => void;
  onSwapSlot?: (containerId: string, rack: number, slot: number, currentMinerId: string) => void;
  onUnassignSlot?: (containerId: string, rack: number, slot: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const slotMap = new Map<string, ContainerWithSlots["slots"][0]>();
  for (const s of container.slots) {
    slotMap.set(`${s.rack}-${s.slot}`, s);
  }

  const assignedMiners = container.slots.filter((s) => s.miner).map((s) => s.miner!);
  const onlineCount = assignedMiners.filter((m) => getMinerStatus(m) === "online").length;
  const totalHashrate = assignedMiners.reduce((sum, m) => sum + (m.latest?.hashrate ?? 0), 0);
  const totalPower = assignedMiners.reduce((sum, m) => sum + (m.latest?.power ?? 0), 0);
  const totalSlots = container.rackCount * container.slotsPerRack;
  const filledSlots = container.slots.filter((s) => s.minerId).length;

  const avgTemp = assignedMiners.length > 0
    ? assignedMiners.reduce((sum, m) => sum + (m.latest?.temperature ?? 0), 0) / assignedMiners.length
    : 0;

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
              {filledSlots}/{totalSlots} slots
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Server className="w-3 h-3" />
              <span className="font-mono">{onlineCount}/{assignedMiners.length}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Cpu className="w-3 h-3" />
              <span className="font-mono">{formatHashrate(totalHashrate)}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span className="font-mono">{formatPower(totalPower)}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Thermometer className="w-3 h-3" />
              <span className="font-mono">{formatTemp(avgTemp)}</span>
            </span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pb-3 space-y-1">
          {Array.from({ length: container.rackCount }, (_, rIdx) => {
            const rackNum = rIdx + 1;
            return (
              <div key={rackNum} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">
                  R{String(rackNum).padStart(2, "0")}
                </span>
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: container.slotsPerRack }, (_, sIdx) => {
                    const slotNum = sIdx + 1;
                    const assignment = slotMap.get(`${rackNum}-${slotNum}`);
                    const miner = assignment?.miner;

                    if (miner) {
                      return (
                        <SlotBlock
                          key={`${rackNum}-${slotNum}`}
                          miner={miner}
                          label={`${String(slotNum).padStart(2, "0")}`}
                          onSwap={onSwapSlot ? () => onSwapSlot(container.id, rackNum, slotNum, miner.id) : undefined}
                          onRemove={onUnassignSlot ? () => onUnassignSlot(container.id, rackNum, slotNum) : undefined}
                        />
                      );
                    }

                    return (
                      <EmptySlot
                        key={`${rackNum}-${slotNum}`}
                        label={`${String(slotNum).padStart(2, "0")}`}
                        onAssign={onAssignSlot ? () => onAssignSlot(container.id, rackNum, slotNum) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function SlotBlock({
  miner,
  label,
  onSwap,
  onRemove,
}: {
  miner: MinerWithLatest;
  label: string;
  onSwap?: () => void;
  onRemove?: () => void;
}) {
  const status = getMinerStatus(miner);
  const colors = statusColors[status] || statusColors.offline;
  const s = miner.latest;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/miners/${miner.id}`}>
          <div
            className={cn(
              "flex items-center justify-center rounded cursor-pointer border transition-all",
              "text-[9px] font-bold font-mono leading-none select-none",
              "h-7 w-14 min-w-0",
              "hover:brightness-110 hover:z-10",
              colors.bg,
              colors.border,
              colors.text
            )}
            data-testid={`slot-${miner.id}`}
          >
            {label}
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
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
          {(onSwap || onRemove) && (
            <div className="flex gap-1 pt-1 border-t">
              {onSwap && (
                <Button variant="outline" size="sm" className="text-[10px] h-5 px-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSwap(); }}>
                  Replace
                </Button>
              )}
              {onRemove && (
                <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}>
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

function EmptySlot({ label, onAssign }: { label: string; onAssign?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-center rounded cursor-pointer transition-all",
            "text-[9px] font-mono leading-none select-none",
            "h-7 w-14 min-w-0",
            "hover:bg-muted",
            emptySlotStyle.bg,
            emptySlotStyle.border,
            emptySlotStyle.text
          )}
          onClick={onAssign}
          data-testid={`slot-empty-${label}`}
        >
          {label}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Empty slot {label}</p>
        {onAssign && <p className="text-[10px] text-muted-foreground">Click to assign a miner</p>}
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
        {label}: <span className="font-mono font-medium">{count}</span>
      </span>
    </div>
  );
}
