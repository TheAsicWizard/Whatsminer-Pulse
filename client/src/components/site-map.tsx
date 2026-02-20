import { Link } from "wouter";
import { getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatTemp, formatPower } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MinerWithLatest } from "@shared/schema";
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

function getMinerLabel(miner: MinerWithLatest): string {
  const name = miner.name;
  if (name.length <= 8) return name;
  const parts = name.match(/\d+/);
  if (parts) return parts[0];
  return name.slice(0, 6);
}

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
          <SiteMapBlock key={miner.id} miner={miner} />
        ))}
      </div>
    </div>
  );
}

function SiteMapBlock({ miner }: { miner: MinerWithLatest }) {
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
              "h-7 min-w-0",
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
