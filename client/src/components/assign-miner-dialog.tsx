import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getMinerStatus } from "@/components/status-indicator";
import { formatHashrate } from "@/lib/format";
import { Search, Server, ArrowRight } from "lucide-react";
import type { MinerWithLatest } from "@shared/schema";

interface AssignMinerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  rack: number;
  slot: number;
  mode: "assign" | "swap";
  currentMinerId?: string;
}

export function AssignMinerDialog({
  open,
  onOpenChange,
  containerId,
  rack,
  slot,
  mode,
  currentMinerId,
}: AssignMinerDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: miners } = useQuery<MinerWithLatest[]>({
    queryKey: ["/api/miners"],
  });

  const assignMutation = useMutation({
    mutationFn: async (minerId: string) => {
      const endpoint = mode === "swap"
        ? `/api/containers/${containerId}/swap`
        : `/api/containers/${containerId}/assign`;
      const body = mode === "swap"
        ? { rack, slot, newMinerId: minerId }
        : { rack, slot, minerId };
      await apiRequest("POST", endpoint, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/miners"] });
      onOpenChange(false);
      toast({ title: mode === "swap" ? "Miner replaced" : "Miner assigned" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (miners ?? []).filter((m) => {
    if (m.id === currentMinerId) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.ipAddress.includes(q) ||
      (m.model?.toLowerCase().includes(q) ?? false) ||
      (m.location?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {mode === "swap" ? "Replace Miner (RMA)" : "Assign Miner to Slot"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {mode === "swap"
            ? `Select a replacement miner for rack ${rack}, slot ${slot}`
            : `Select a miner for rack ${rack}, slot ${slot}`}
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, IP, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm h-9"
            data-testid="input-search-miner"
          />
        </div>

        <div className="overflow-y-auto max-h-[400px] space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-4">
              <Server className="w-6 h-6 mx-auto text-muted-foreground/40 mb-1" />
              <p className="text-xs text-muted-foreground">No miners found</p>
            </div>
          ) : (
            filtered.map((miner) => {
              const status = getMinerStatus(miner);
              return (
                <button
                  key={miner.id}
                  className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/80 transition-colors text-left"
                  onClick={() => assignMutation.mutate(miner.id)}
                  disabled={assignMutation.isPending}
                  data-testid={`assign-miner-${miner.id}`}
                >
                  <StatusDot status={status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{miner.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {miner.ipAddress} · {miner.model ?? "WhatsMiner"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-mono">
                      {formatHashrate(miner.latest?.hashrate ?? 0)}
                    </p>
                    <Badge variant="outline" className="text-[9px] px-1 no-default-active-elevate">
                      {status}
                    </Badge>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-emerald-500",
    warning: "bg-amber-400",
    critical: "bg-red-500",
    offline: "bg-gray-400",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || colors.offline}`} />;
}
