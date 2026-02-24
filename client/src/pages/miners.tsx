import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusIndicator, getMinerStatus } from "@/components/status-indicator";
import { SiteMap } from "@/components/site-map";
import { formatHashrate, formatPower, formatTemp, formatUptime } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useState, useDeferredValue } from "react";
import {
  Cpu,
  Zap,
  Thermometer,
  Server,
  Search,
  Fan,
  Clock,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MinerWithLatest } from "@shared/schema";

const PAGE_SIZE = 50;

export default function Miners() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search);

  const queryParams = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (deferredSearch) queryParams.set("search", deferredSearch);
  const minersUrl = `/api/miners?${queryParams}`;

  const { data, isLoading } = useQuery<{ miners: MinerWithLatest[]; total: number }>({
    queryKey: [minersUrl],
    refetchInterval: 10000,
  });

  const miners = data?.miners;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/miners/batch/delete", { minerIds: ids });
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      setSelectedIds(new Set());
      toast({ title: `Deleted ${data.deleted} miners` });
    },
    onError: (err: Error) => {
      toast({ title: "Batch delete failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!miners) return;
    if (selectedIds.size === miners.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(miners.map((m) => m.id)));
    }
  };

  const handleExportCsv = () => {
    window.open("/api/miners/export/csv", "_blank");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" data-testid="text-miners-title">
            Miners
          </h2>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} devices registered` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, IP, or location..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-miners"
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="no-default-active-elevate">
              {selectedIds.size} selected
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={batchDeleteMutation.isPending}
                  data-testid="button-batch-delete"
                >
                  {batchDeleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} miners?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the selected miners and their telemetry data. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-batch-delete-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => batchDeleteMutation.mutate(Array.from(selectedIds))}
                    className="bg-destructive text-destructive-foreground"
                    data-testid="button-batch-delete-confirm"
                  >
                    Delete {selectedIds.size} miners
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : miners && miners.length > 0 ? (
        view === "grid" ? (
          <Card>
            <CardContent className="p-4">
              <SiteMap miners={miners} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1">
              <Checkbox
                checked={miners.length > 0 && selectedIds.size === miners.length}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all"
              />
              <span className="text-xs text-muted-foreground">Select all on this page</span>
            </div>
            {miners.map((miner) => (
              <MinerRow
                key={miner.id}
                miner={miner}
                selected={selectedIds.has(miner.id)}
                onToggleSelect={() => toggleSelect(miner.id)}
              />
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No miners match your search" : "No miners configured"}
            </p>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MinerRow({ miner, selected, onToggleSelect }: { miner: MinerWithLatest; selected?: boolean; onToggleSelect?: () => void }) {
  const status = getMinerStatus(miner);
  const s = miner.latest;
  return (
    <div className="flex items-center gap-2">
      {onToggleSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          data-testid={`checkbox-miner-${miner.id}`}
        />
      )}
      <Link href={`/miners/${miner.id}`} className="flex-1">
        <Card className="cursor-pointer hover-elevate" data-testid={`row-miner-${miner.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-[180px]">
                <StatusIndicator status={status} />
                <div>
                  <p className="text-sm font-medium">{miner.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {miner.ipAddress}:{miner.port}
                  </p>
                </div>
              </div>

              {s ? (
                <div className="flex items-center gap-5 flex-wrap flex-1">
                  <MiniMetric icon={<Cpu className="w-3.5 h-3.5" />} label="Hashrate" value={formatHashrate(s.hashrate ?? 0)} />
                  <MiniMetric icon={<Thermometer className="w-3.5 h-3.5" />} label="Temp" value={formatTemp(s.temperature ?? 0)} />
                  <MiniMetric icon={<Zap className="w-3.5 h-3.5" />} label="Power" value={formatPower(s.power ?? 0)} />
                  <MiniMetric icon={<Fan className="w-3.5 h-3.5" />} label="Fan In" value={`${s.fanSpeedIn ?? 0}`} />
                  <MiniMetric icon={<Clock className="w-3.5 h-3.5" />} label="Uptime" value={formatUptime(s.elapsed ?? 0)} />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No data</span>
              )}

              <div className="flex items-center gap-2 ml-auto shrink-0">
                {miner.location && (
                  <Badge variant="secondary" className="text-[10px] no-default-active-elevate">{miner.location}</Badge>
                )}
                <Badge variant="outline" className="text-[10px] no-default-active-elevate">{miner.model || "WhatsMiner"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-mono font-medium">{value}</p>
      </div>
    </div>
  );
}
