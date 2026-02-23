import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatTemp, formatPower } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Box, Server, Cpu, Zap, Thermometer, Settings, ZoomIn, ZoomOut, Maximize2, ArrowLeft } from "lucide-react";
import type { MinerWithLatest, ContainerWithSlots, Container, SiteSettings } from "@shared/schema";
import { cn } from "@/lib/utils";
import { wolfHollowMapUrl } from "@/lib/wolf-hollow-template";

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

function getContainerHealthColor(c: ContainerSummary): { bg: string; border: string; glow: string; label: string } {
  if (c.totalAssigned === 0) {
    return { bg: "#374151", border: "#4b5563", glow: "none", label: "empty" };
  }
  const total = c.totalAssigned;
  const critPct = c.criticalCount / total;
  const warnPct = c.warningCount / total;
  const offPct = c.offlineCount / total;
  const onPct = c.onlineCount / total;

  if (critPct > 0.1) {
    return { bg: "#991b1b", border: "#ef4444", glow: "0 0 8px rgba(239,68,68,0.4)", label: "critical" };
  }
  if (critPct > 0) {
    return { bg: "#7f1d1d", border: "#dc2626", glow: "0 0 6px rgba(220,38,38,0.3)", label: "critical" };
  }
  if (warnPct > 0.2) {
    return { bg: "#78350f", border: "#f59e0b", glow: "0 0 6px rgba(245,158,11,0.3)", label: "warning" };
  }
  if (warnPct > 0) {
    return { bg: "#713f12", border: "#d97706", glow: "none", label: "warning" };
  }
  if (offPct > 0.5) {
    return { bg: "#374151", border: "#6b7280", glow: "none", label: "offline" };
  }
  if (onPct >= 0.95) {
    return { bg: "#14532d", border: "#22c55e", glow: "0 0 6px rgba(34,197,94,0.3)", label: "healthy" };
  }
  return { bg: "#166534", border: "#16a34a", glow: "none", label: "healthy" };
}

const LAYOUT_WIDTH = 1400;
const LAYOUT_HEIGHT = 1000;

export function ContainerSummaryMap({ containers, onAssignSlot, onSwapSlot, onUnassignSlot }: ContainerSummaryMapProps) {
  const [selectedContainer, setSelectedContainer] = useState<ContainerSummary | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const initialZoomSet = useRef(false);

  const { data: siteSettings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });

  const useCustomLayout = siteSettings?.useCustomLayout && containers.some(
    (c) => c.layoutX != null && c.layoutY != null
  );

  useEffect(() => {
    if (viewportRef.current && !initialZoomSet.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const fitZoom = Math.min(rect.width / LAYOUT_WIDTH, rect.height / LAYOUT_HEIGHT);
        setZoom(Math.max(0.3, fitZoom));
        initialZoomSet.current = true;
      }
    }
  }, [containers]);

  const currentZoom = zoom ?? 0.5;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(3, Math.max(0.3, (z ?? 0.5) + delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const fitZoom = Math.min(rect.width / LAYOUT_WIDTH, rect.height / LAYOUT_HEIGHT);
      setZoom(fitZoom);
    } else {
      setZoom(0.5);
    }
    setPan({ x: 0, y: 0 });
  }, []);

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
      assigned: acc.assigned + c.totalAssigned,
      empty: acc.empty + (c.rackCount * c.slotsPerRack - c.totalAssigned),
    }),
    { online: 0, warning: 0, critical: 0, offline: 0, assigned: 0, empty: 0 }
  );

  const COLS = 8;
  const rows: ContainerSummary[][] = [];
  for (let i = 0; i < containers.length; i += COLS) {
    rows.push(containers.slice(i, i + COLS));
  }

  if (selectedContainer) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedContainer(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back-to-site-map"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Site Map
          </button>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-semibold">{selectedContainer.name}</span>
          <Badge variant="outline" className="text-[10px] no-default-active-elevate">
            {selectedContainer.totalAssigned}/{selectedContainer.rackCount * selectedContainer.slotsPerRack} slots
          </Badge>
        </div>

        <ContainerDetailPanel
          container={selectedContainer}
          onAssignSlot={onAssignSlot}
          onSwapSlot={onSwapSlot}
          onUnassignSlot={onUnassignSlot}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="top-down-site-map">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <LegendItem color="bg-emerald-500" label="Online" count={totals.online} />
          <LegendItem color="bg-amber-400" label="Warning" count={totals.warning} />
          <LegendItem color="bg-red-500" label="Critical" count={totals.critical} />
          <LegendItem color="bg-gray-400 dark:bg-gray-600" label="Offline" count={totals.offline} />
          <LegendItem color="bg-muted/50 border border-dashed border-muted-foreground/30" label="Empty" count={totals.empty} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(3, (z ?? 0.5) + 0.2))}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, (z ?? 0.5) - 0.2))}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="button-reset-view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-muted-foreground font-mono ml-1 w-8 text-center">{Math.round(currentZoom * 100)}%</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-lg border border-border/50 select-none"
        style={{
          height: "520px",
          background: "linear-gradient(135deg, hsl(220, 15%, 8%) 0%, hsl(220, 12%, 11%) 50%, hsl(220, 15%, 8%) 100%)",
          cursor: isPanning ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-testid="site-map-viewport"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, hsl(220, 10%, 18%) 1px, transparent 0)
            `,
            backgroundSize: `${20 * currentZoom}px ${20 * currentZoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            opacity: 0.4,
          }}
        />

        {useCustomLayout ? (
          <div
            className="absolute"
            style={{
              width: `${LAYOUT_WIDTH}px`,
              height: `${LAYOUT_HEIGHT}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${currentZoom})`,
              transformOrigin: "0 0",
            }}
          >
            {containers.map((container) => {
              if (container.layoutX == null || container.layoutY == null) return null;
              const rotation = container.layoutRotation ?? 0;
              return (
                <div
                  key={container.id}
                  className="absolute"
                  style={{
                    left: `${container.layoutX}%`,
                    top: `${container.layoutY}%`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                    zIndex: 10,
                  }}
                >
                  <ContainerBlock
                    container={container}
                    onClick={() => setSelectedContainer(container)}
                    compact
                    containerScale={siteSettings?.containerScale ?? 1}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${currentZoom})`,
              transformOrigin: "0 0",
              padding: "24px",
            }}
          >
            <div className="flex flex-col gap-4">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-3 items-start">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: "28px",
                      height: "68px",
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                    }}
                  >
                    <span className="text-[9px] font-mono text-muted-foreground/40 rotate-180">
                      ROW {rowIdx + 1}
                    </span>
                  </div>
                  {row.map((container) => (
                    <ContainerBlock
                      key={container.id}
                      container={container}
                      onClick={() => setSelectedContainer(container)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-background/70 backdrop-blur-sm rounded px-2 py-1 border border-border/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {containers.length} containers &middot; {totals.assigned.toLocaleString()} miners
          </span>
        </div>
      </div>
    </div>
  );
}

function ContainerBlock({ container, onClick, compact, containerScale = 1 }: { container: ContainerSummary; onClick: () => void; compact?: boolean; containerScale?: number }) {
  const health = getContainerHealthColor(container);
  const totalSlots = container.rackCount * container.slotsPerRack;
  const healthPct = container.totalAssigned > 0
    ? Math.round((container.onlineCount / container.totalAssigned) * 100)
    : 0;

  const onlinePct = container.totalAssigned > 0 ? container.onlineCount / totalSlots : 0;
  const warnPct = container.totalAssigned > 0 ? container.warningCount / totalSlots : 0;
  const critPct = container.totalAssigned > 0 ? container.criticalCount / totalSlots : 0;
  const offPct = container.totalAssigned > 0 ? container.offlineCount / totalSlots : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={cn("group relative flex flex-col items-center transition-all duration-200", !compact && "hover:scale-105")}
          style={{
            width: compact ? `${24 * containerScale}px` : "100px",
            height: compact ? `${10 * containerScale}px` : "68px",
            cursor: "pointer",
          }}
          data-testid={`container-block-${container.id}`}
        >
          <div
            className="relative w-full h-full rounded-sm overflow-hidden transition-shadow duration-200"
            style={{
              backgroundColor: health.bg,
              border: `1px solid ${health.border}`,
              boxShadow: compact ? "0 1px 2px rgba(0,0,0,0.4)" : `${health.glow}, 0 2px 4px rgba(0,0,0,0.3)`,
            }}
          >
            <div className={cn("relative flex items-center justify-center h-full", compact ? "px-0.5" : "flex-col gap-0.5 px-1")}>
              <span
                className={cn("font-bold font-mono text-white/90 leading-none drop-shadow-sm", compact ? "tracking-tight" : "text-[11px] tracking-wide")}
                style={compact ? { fontSize: `${4 * containerScale}px` } : undefined}
              >
                {container.name}
              </span>

              {container.totalAssigned > 0 && !compact && (
                <>
                  <span className="text-[8px] font-mono text-white/50 leading-none">
                    {container.onlineCount}/{container.totalAssigned}
                  </span>
                  <div className="flex w-[70%] h-[3px] rounded-full overflow-hidden mt-0.5 bg-black/30">
                    {onlinePct > 0 && <div className="h-full" style={{ width: `${onlinePct * 100}%`, backgroundColor: "#22c55e" }} />}
                    {warnPct > 0 && <div className="h-full" style={{ width: `${warnPct * 100}%`, backgroundColor: "#f59e0b" }} />}
                    {critPct > 0 && <div className="h-full" style={{ width: `${critPct * 100}%`, backgroundColor: "#ef4444" }} />}
                    {offPct > 0 && <div className="h-full" style={{ width: `${offPct * 100}%`, backgroundColor: "#6b7280" }} />}
                  </div>
                </>
              )}

              {container.totalAssigned === 0 && !compact && (
                <span className="text-[8px] font-mono text-white/30 leading-none">empty</span>
              )}
            </div>

            <div className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]" data-testid={`container-tooltip-${container.id}`}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-xs">{container.name}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 no-default-active-elevate",
                health.label === "critical" && "border-red-500 text-red-400",
                health.label === "warning" && "border-amber-500 text-amber-400",
                health.label === "healthy" && "border-emerald-500 text-emerald-400",
              )}
            >
              {healthPct}% healthy
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Server className="w-2.5 h-2.5" /> Miners
            </span>
            <span className="text-[10px] font-mono text-right">
              <span className="text-emerald-400">{container.onlineCount}</span>
              {container.warningCount > 0 && <span className="text-amber-400"> / {container.warningCount}w</span>}
              {container.criticalCount > 0 && <span className="text-red-400"> / {container.criticalCount}c</span>}
              <span className="text-muted-foreground"> / {container.totalAssigned}</span>
            </span>

            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Cpu className="w-2.5 h-2.5" /> Hashrate
            </span>
            <span className="text-[10px] font-mono text-right">{formatHashrate(container.totalHashrate)}</span>

            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Power
            </span>
            <span className="text-[10px] font-mono text-right">{formatPower(container.totalPower)}</span>

            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Thermometer className="w-2.5 h-2.5" /> Avg Temp
            </span>
            <span className="text-[10px] font-mono text-right">{formatTemp(container.avgTemp)}</span>
          </div>

          <p className="text-[9px] text-muted-foreground/60 pt-0.5">Click to view rack details</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ContainerDetailPanel({
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
  const { data: detail, isLoading } = useQuery<ContainerWithSlots>({
    queryKey: ["/api/containers", container.id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/containers/${container.id}/detail`);
      if (!res.ok) throw new Error("Failed to load container details");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const totalSlots = container.rackCount * container.slotsPerRack;
  const healthPct = container.totalAssigned > 0
    ? ((container.onlineCount / container.totalAssigned) * 100)
    : 0;

  const healthColor = healthPct >= 95
    ? "text-emerald-500"
    : healthPct >= 80
    ? "text-amber-400"
    : "text-red-500";

  if (isLoading || !detail) {
    return (
      <Card>
        <CardContent className="pb-3 pt-4">
          <div className="flex items-center gap-4 mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-3 overflow-x-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] w-[80px] shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const slotMap = new Map<string, ContainerWithSlots["slots"][0]>();
  for (const s of detail.slots) {
    slotMap.set(`${s.rack}-${s.slot}`, s);
  }

  const cols = 4;
  const rows = Math.ceil(container.slotsPerRack / cols);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{container.name}</CardTitle>
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
      </CardHeader>
      <CardContent className="pb-3">
        <div
          className="rounded-lg p-3 overflow-x-auto"
          style={{ backgroundColor: "#005500" }}
          data-testid={`container-rack-view-${container.id}`}
        >
          <div className="flex gap-2 min-w-max">
            {Array.from({ length: container.rackCount }, (_, rIdx) => {
              const rackNum = rIdx + 1;
              const rackLabel = `${container.name}-R${String(rackNum).padStart(3, "0")}`;

              return (
                <div
                  key={rackNum}
                  className="flex flex-col rounded"
                  style={{ backgroundColor: "#003300" }}
                >
                  <div className="flex items-center justify-between px-1.5 py-1 border-b" style={{ borderColor: "#006600" }}>
                    <span className="text-[9px] font-mono text-green-200 truncate">{rackLabel}</span>
                    <Settings className="w-2.5 h-2.5 text-green-400/60 shrink-0" />
                  </div>
                  <div className="p-1.5 flex-1">
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 18px)` }}>
                      {Array.from({ length: rows * cols }, (_, idx) => {
                        const slotNum = idx + 1;
                        if (slotNum > container.slotsPerRack) return <div key={`empty-${idx}`} />;

                        const assignment = slotMap.get(`${rackNum}-${slotNum}`);
                        const miner = assignment?.miner;
                        if (!miner) {
                          return (
                            <Tooltip key={`vacant-${rackNum}-${slotNum}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className="cursor-pointer hover:brightness-150"
                                  style={{ width: "18px", height: "18px", backgroundColor: "#8a8a8a" }}
                                  onClick={() => onAssignSlot?.(container.id, rackNum, slotNum)}
                                  data-testid={`vacant-slot-${container.id}-${rackNum}-${slotNum}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-[10px]">Empty - Click to assign miner</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return (
                          <RackSlot
                            key={`${rackNum}-${slotNum}`}
                            miner={miner}
                            containerId={container.id}
                            rackNum={rackNum}
                            slotNum={slotNum}
                            onSwap={() => onSwapSlot?.(container.id, rackNum, slotNum, miner.id)}
                            onUnassign={() => onUnassignSlot?.(container.id, rackNum, slotNum)}
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
    </Card>
  );
}

function RackSlot({
  miner,
  containerId,
  rackNum,
  slotNum,
  onSwap,
  onUnassign,
}: {
  miner: MinerWithLatest;
  containerId: string;
  rackNum: number;
  slotNum: number;
  onSwap?: () => void;
  onUnassign?: () => void;
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
  const borderColor = status === "critical" ? "#dc2626" : status === "warning" ? "#d97706" : "transparent";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/miners/${miner.id}`}>
          <div
            className="cursor-pointer hover:brightness-125"
            style={{
              width: "18px",
              height: "18px",
              backgroundColor: bgColor,
              border: status === "critical" || status === "warning" ? `1px solid ${borderColor}` : "none",
            }}
            data-testid={`rack-slot-${miner.id}`}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{miner.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{miner.ipAddress}</p>
          {miner.macAddress && <p className="text-[10px] text-muted-foreground font-mono">{miner.macAddress}</p>}
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
          <div className="flex gap-2 pt-1 border-t">
            {onSwap && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSwap(); }}
                className="text-[9px] text-primary hover:underline"
                data-testid={`button-swap-${miner.id}`}
              >
                Replace/Swap
              </button>
            )}
            {onUnassign && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnassign(); }}
                className="text-[9px] text-red-400 hover:underline"
                data-testid={`button-unassign-${miner.id}`}
              >
                Remove
              </button>
            )}
          </div>
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
          {miner.macAddress && <p className="text-[10px] text-muted-foreground font-mono">{miner.macAddress}</p>}
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
