import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Plus,
  Server,
  Trash2,
  Shield,
  Scan,
  Loader2,
  Wifi,
  WifiOff,
  Radio,
  Box,
  Edit2,
  RefreshCw,
  Upload,
  FileText,
  CheckCircle2,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  DollarSign,
  Map,
} from "lucide-react";
import type { Miner, AlertRule, ScanConfig, ScanProgress, BulkScanProgress, Container, ContainerWithSlots, MinerWithLatest, SiteSettings } from "@shared/schema";
import SiteLayoutEditor from "@/components/site-layout-editor";

export default function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
      <div>
        <h2 className="text-xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage site layout, miners, network scanning, and alert rules
        </p>
      </div>

      <Tabs defaultValue="site" className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="settings-tabs">
          <TabsTrigger value="site" data-testid="tab-site">
            <Map className="w-3.5 h-3.5 mr-1.5" />
            Site Layout
          </TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">
            <Box className="w-3.5 h-3.5 mr-1.5" />
            Import & Containers
          </TabsTrigger>
          <TabsTrigger value="network" data-testid="tab-network">
            <Radio className="w-3.5 h-3.5 mr-1.5" />
            Network
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="general" data-testid="tab-general">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="space-y-4 mt-4">
          <SiteLayoutEditor />
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <ForemanImport />
          <ContainerManagement />
        </TabsContent>

        <TabsContent value="network" className="space-y-4 mt-4">
          <NetworkScanner />
          <MinerManagement />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <AlertRuleManagement />
        </TabsContent>

        <TabsContent value="general" className="space-y-4 mt-4">
          <CostSettings />
          <DangerZone />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ForemanImport() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    totalRows: number;
    containerCount: number;
  } | null>(null);

  const { data: mappingStats } = useQuery<{
    totalMappings: number;
    containerCount: number;
    containers: string[];
  }>({
    queryKey: ["/api/mac-mappings/stats"],
  });

  const macAssignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/containers/auto-assign-mac");
      return res.json();
    },
    onSuccess: (data: { assigned: number; created: number; containersCreated: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      const parts = [];
      if (data.containersCreated > 0) parts.push(`Created ${data.containersCreated} containers`);
      if (data.created > 0) parts.push(`Created ${data.created} miners from CSV`);
      parts.push(`Assigned ${data.assigned} miners to their physical positions`);
      toast({ title: parts.join(". ") });
    },
    onError: (err: Error) => {
      toast({ title: "MAC assignment failed", description: err.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/mac-mappings");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mac-mappings/stats"] });
      setImportResult(null);
      toast({ title: "MAC mappings cleared" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/mac-mappings/import-foreman", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Import failed", description: data.message, variant: "destructive" });
        return;
      }

      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/mac-mappings/stats"] });
      toast({ title: `Imported ${data.imported} MAC-to-position mappings` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const hasMappings = mappingStats && mappingStats.totalMappings > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Foreman Location Import
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Import a Foreman CSV export to map MAC addresses to physical rack positions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasMappings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => macAssignMutation.mutate()}
                disabled={macAssignMutation.isPending}
                data-testid="button-mac-assign"
              >
                {macAssignMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                )}
                Assign by MAC
              </Button>
            )}
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-foreman-csv"
              />
              <Button
                size="sm"
                asChild
                disabled={uploading}
              >
                <span data-testid="button-upload-foreman">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="w-4 h-4 mr-1" />
                  )}
                  {uploading ? "Importing..." : "Upload CSV"}
                </span>
              </Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {importResult && (
          <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20 space-y-2" data-testid="import-result">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">
                Import complete
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>Imported: <span className="font-mono font-medium text-foreground">{importResult.imported.toLocaleString()}</span></div>
              <div>Skipped: <span className="font-mono font-medium text-foreground">{importResult.skipped}</span></div>
              <div>Containers: <span className="font-mono font-medium text-foreground">{importResult.containerCount}</span></div>
            </div>
          </div>
        )}

        {hasMappings ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {mappingStats.totalMappings.toLocaleString()} MAC-to-position mappings loaded
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Across {mappingStats.containerCount} containers
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                data-testid="button-clear-mappings"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              After scanning your network, miners will be automatically placed in the correct rack position based on their MAC address.
              You can also click "Assign by MAC" to manually trigger the assignment.
            </p>
          </div>
        ) : (
          <div className="text-center py-6 space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No MAC mappings loaded. Upload a Foreman CSV export to map miners to their physical positions.
            </p>
            <p className="text-xs text-muted-foreground">
              The CSV should contain: miner_mac, miner_rack (e.g. C260-R008), miner_row, miner_index
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NetworkScanner() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startIp, setStartIp] = useState("");
  const [endIp, setEndIp] = useState("");
  const [port, setPort] = useState("4028");
  const [scanningConfigId, setScanningConfigId] = useState<string | null>(null);
  const [bulkScanning, setBulkScanning] = useState(false);

  const { data: configs, isLoading } = useQuery<ScanConfig[]>({
    queryKey: ["/api/scan-configs"],
  });

  const { data: scanProgress } = useQuery<ScanProgress>({
    queryKey: ["/api/scan-configs", scanningConfigId, "progress"],
    enabled: !!scanningConfigId,
    refetchInterval: scanningConfigId ? 1000 : false,
  });

  const { data: bulkProgress } = useQuery<BulkScanProgress>({
    queryKey: ["/api/scan-all/progress"],
    enabled: bulkScanning,
    refetchInterval: bulkScanning ? 1000 : false,
  });

  useEffect(() => {
    if (bulkProgress?.status === "completed" || bulkProgress?.status === "error") {
      if (bulkProgress.status === "completed") {
        toast({ title: "Bulk scan complete", description: `Scanned ${bulkProgress.totalContainers} containers, found ${bulkProgress.totalFound} miners` });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
        queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      }
      setTimeout(() => setBulkScanning(false), 3000);
    }
  }, [bulkProgress?.status]);

  useEffect(() => {
    if (scanProgress?.status === "completed" || scanProgress?.status === "error") {
      if (scanProgress.status === "completed") {
        toast({ title: `Scan complete`, description: `Found ${scanProgress.found} miners` });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
        queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
      }
      setTimeout(() => setScanningConfigId(null), 3000);
    }
  }, [scanProgress?.status]);

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scan-configs", {
        name,
        startIp,
        endIp,
        port: parseInt(port),
        enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
      setOpen(false);
      setName("");
      setStartIp("");
      setEndIp("");
      setPort("4028");
      toast({ title: "IP range added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add range", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scan-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
      toast({ title: "IP range removed" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/scan-configs/${id}/scan`);
      return id;
    },
    onSuccess: (id: string) => {
      setScanningConfigId(id);
      toast({ title: "Scan started", description: "Scanning network for WhatsMiner devices..." });
    },
    onError: (err: Error) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkScanMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scan-all");
    },
    onSuccess: () => {
      setBulkScanning(true);
      toast({ title: "Bulk scan started", description: "Scanning all containers sequentially to keep performance smooth..." });
    },
    onError: (err: Error) => {
      toast({ title: "Bulk scan failed", description: err.message, variant: "destructive" });
    },
  });

  const isScanning = scanningConfigId !== null && scanProgress?.status === "scanning";
  const isBulkActive = bulkScanning && bulkProgress?.status === "scanning";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Network Scanner
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Scan IP ranges to discover WhatsMiner devices on your network
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkScanMutation.mutate()}
              disabled={isScanning || isBulkActive || bulkScanMutation.isPending}
              data-testid="button-scan-all"
            >
              {isBulkActive ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Scan className="w-4 h-4 mr-1" />
              )}
              Scan All
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-scan-range">
                  <Plus className="w-4 h-4 mr-1" />
                  Add IP Range
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add IP Range</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="range-name">Name</Label>
                  <Input
                    id="range-name"
                    placeholder="e.g. Building A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-range-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-ip">Start IP</Label>
                    <Input
                      id="start-ip"
                      placeholder="192.168.1.1"
                      value={startIp}
                      onChange={(e) => setStartIp(e.target.value)}
                      data-testid="input-start-ip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-ip">End IP</Label>
                    <Input
                      id="end-ip"
                      placeholder="192.168.1.254"
                      value={endIp}
                      onChange={(e) => setEndIp(e.target.value)}
                      data-testid="input-end-ip"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scan-port">API Port</Label>
                  <Input
                    id="scan-port"
                    placeholder="4028"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    data-testid="input-scan-port"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    WhatsMiner CGMiner API port (default: 4028)
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => addMutation.mutate()}
                  disabled={!name || !startIp || !endIp || addMutation.isPending}
                  data-testid="button-submit-range"
                >
                  {addMutation.isPending ? "Adding..." : "Add IP Range"}
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {bulkScanning && bulkProgress && bulkProgress.status === "scanning" && (
          <div className="mb-4 p-3 rounded-md bg-blue-500/10 border border-blue-500/20 space-y-2" data-testid="bulk-scan-progress">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="font-medium">
                Scanning all containers... {bulkProgress.completedContainers}/{bulkProgress.totalContainers}
              </span>
              <Badge variant="outline" className="ml-auto text-[10px] no-default-active-elevate">
                {bulkProgress.totalFound} found
              </Badge>
            </div>
            <Progress
              value={bulkProgress.totalIps > 0 ? (bulkProgress.scannedIps / bulkProgress.totalIps) * 100 : 0}
              className="h-1.5"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Current: {bulkProgress.currentContainer}</span>
              <span>{bulkProgress.scannedIps.toLocaleString()}/{bulkProgress.totalIps.toLocaleString()} IPs</span>
            </div>
          </div>
        )}

        {bulkScanning && bulkProgress?.status === "completed" && (
          <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20" data-testid="bulk-scan-results">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">
                Bulk scan complete: {bulkProgress.totalFound} miners found across {bulkProgress.totalContainers} containers
              </span>
            </div>
          </div>
        )}

        {isScanning && scanProgress && (
          <div className="mb-4 p-3 rounded-md bg-primary/10 border border-primary/20 space-y-2" data-testid="scan-progress">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="font-medium">
                Scanning... {scanProgress.scanned}/{scanProgress.total} IPs
              </span>
              <Badge variant="outline" className="ml-auto text-[10px] no-default-active-elevate">
                {scanProgress.found} found
              </Badge>
            </div>
            <Progress
              value={scanProgress.total > 0 ? (scanProgress.scanned / scanProgress.total) * 100 : 0}
              className="h-1.5"
            />
          </div>
        )}

        {scanProgress?.status === "completed" && scanningConfigId && (
          <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20 space-y-2" data-testid="scan-results">
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">
                Scan complete: {scanProgress.found} miners found
              </span>
            </div>
            {scanProgress.results.length > 0 && (
              <div className="space-y-1 mt-2">
                {scanProgress.results.map((r, i) => (
                  <div key={i} className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                    <Wifi className="w-3 h-3 text-green-500" />
                    {r.ip}:{r.port} - {r.model}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : configs && configs.length > 0 ? (
          <ScanConfigList
            configs={configs}
            isScanning={isScanning || isBulkActive}
            scanMutation={scanMutation}
            deleteMutation={deleteMutation}
          />
        ) : (
          <div className="text-center py-6 space-y-2">
            <WifiOff className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No IP ranges configured. Add an IP range to scan for miners on your network.
            </p>
            <p className="text-xs text-muted-foreground">
              Example: 192.168.1.1 — 192.168.1.254
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ContainerGroup {
  container: string;
  configs: ScanConfig[];
  totalIps: number;
}

function ScanConfigList({
  configs,
  isScanning,
  scanMutation,
  deleteMutation,
}: {
  configs: ScanConfig[];
  isScanning: boolean;
  scanMutation: any;
  deleteMutation: any;
}) {
  const [search, setSearch] = useState("");
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const grouped = configs.reduce<Record<string, ScanConfig[]>>((acc, config) => {
    const match = config.name.match(/^([^\s]+)/);
    const container = match ? match[1] : "Other";
    if (!acc[container]) acc[container] = [];
    acc[container].push(config);
    return acc;
  }, {});

  const containerGroups: ContainerGroup[] = Object.entries(grouped)
    .map(([container, cfgs]) => ({
      container,
      configs: cfgs,
      totalIps: cfgs.reduce((sum, c) => {
        const startParts = c.startIp.split(".").map(Number);
        const endParts = c.endIp.split(".").map(Number);
        return sum + (endParts[3] - startParts[3] + 1);
      }, 0),
    }))
    .sort((a, b) => a.container.localeCompare(b.container, undefined, { numeric: true }));

  const filtered = search
    ? containerGroups.filter((g) =>
        g.container.toLowerCase().includes(search.toLowerCase()) ||
        g.configs.some((c) => c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.startIp.includes(search) || c.endIp.includes(search))
      )
    : containerGroups;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleExpand = (container: string) => {
    setExpandedContainers((prev) => {
      const next = new Set(prev);
      if (next.has(container)) next.delete(container);
      else next.add(container);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search containers or IP ranges..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-8 text-sm"
            data-testid="input-search-scan-configs"
          />
        </div>
        <Badge variant="outline" className="shrink-0 text-xs no-default-active-elevate">
          {filtered.length} containers · {configs.length} ranges
        </Badge>
      </div>

      <div className="space-y-1">
        {pageItems.map((group) => {
          const isExpanded = expandedContainers.has(group.container);
          return (
            <div key={group.container} className="rounded-md border bg-muted/30" data-testid={`scan-group-${group.container}`}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                onClick={() => toggleExpand(group.container)}
                data-testid={`button-expand-${group.container}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium">{group.container}</span>
                <Badge variant="secondary" className="text-[10px] ml-1 no-default-active-elevate">
                  {group.configs.length} subnets
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {group.totalIps} IPs
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2 space-y-1 border-t">
                  {group.configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between gap-3 py-1.5 px-2 rounded bg-background/50"
                      data-testid={`scan-config-${config.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{config.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {config.startIp} — {config.endIp} : {config.port}
                        </p>
                        {config.lastScanResult && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {config.lastScanResult}
                            {config.lastScanAt && (
                              <> · {new Date(config.lastScanAt).toLocaleString()}</>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => scanMutation.mutate(config.id)}
                          disabled={isScanning || scanMutation.isPending}
                          data-testid={`button-scan-${config.id}`}
                        >
                          {scanMutation.isPending && scanMutation.variables === config.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Scan className="w-3 h-3 mr-1" />
                          )}
                          Scan
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteMutation.mutate(config.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-config-${config.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            data-testid="button-scan-prev-page"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            data-testid="button-scan-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function MinerManagement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4028");
  const [location, setLocation] = useState("");
  const [model, setModel] = useState("WhatsMiner");

  const { data: minersData, isLoading } = useQuery<{ miners: Miner[]; total: number }>({
    queryKey: ["/api/miners?page=1&limit=200"],
  });
  const miners = minersData?.miners;

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/miners", {
        name,
        ipAddress: ip,
        port: parseInt(port),
        location,
        model,
        status: "offline",
        source: "manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
      setOpen(false);
      setName("");
      setIp("");
      setPort("4028");
      setLocation("");
      setModel("WhatsMiner");
      toast({ title: "Miner added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add miner", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/miners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
      toast({ title: "Miner removed" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="w-4 h-4" />
            Miners
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-miner">
                <Plus className="w-4 h-4 mr-1" />
                Add Miner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Miner</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="miner-name">Name</Label>
                  <Input
                    id="miner-name"
                    placeholder="e.g. Rack A - Unit 1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-miner-name"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="miner-ip">IP Address</Label>
                    <Input
                      id="miner-ip"
                      placeholder="10.21.29.173"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      data-testid="input-miner-ip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="miner-port">Port</Label>
                    <Input
                      id="miner-port"
                      placeholder="4028"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      data-testid="input-miner-port"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="miner-location">Location</Label>
                    <Input
                      id="miner-location"
                      placeholder="e.g. Building A"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      data-testid="input-miner-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="miner-model">Model</Label>
                    <Input
                      id="miner-model"
                      placeholder="WhatsMiner M50S"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      data-testid="input-miner-model"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => addMutation.mutate()}
                  disabled={!name || !ip || addMutation.isPending}
                  data-testid="button-submit-miner"
                >
                  {addMutation.isPending ? "Adding..." : "Add Miner"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : miners && miners.length > 0 ? (
          <div className="space-y-2">
            {miners.map((miner) => (
              <div
                key={miner.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                data-testid={`settings-miner-${miner.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{miner.name}</p>
                    {miner.source === "scanned" && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 no-default-active-elevate">
                        scanned
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {miner.ipAddress}:{miner.port}
                    {miner.location && ` / ${miner.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] no-default-active-elevate">
                    {miner.model || "WhatsMiner"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(miner.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-miner-${miner.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No miners configured. Add your first miner to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRuleManagement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [metric, setMetric] = useState("temperature");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("");
  const [severity, setSeverity] = useState("warning");

  const { data: rules, isLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/alert-rules"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/alert-rules", {
        name: ruleName,
        metric,
        operator,
        threshold: parseFloat(threshold),
        severity,
        enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      setOpen(false);
      setRuleName("");
      setMetric("temperature");
      setOperator(">");
      setThreshold("");
      setSeverity("warning");
      toast({ title: "Alert rule created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create rule", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/alert-rules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/alert-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "Rule removed" });
    },
  });

  const metricOptions = [
    { value: "temperature", label: "Board Temperature" },
    { value: "envTemp", label: "Env Temperature" },
    { value: "hashrate", label: "Hashrate (GH/s)" },
    { value: "power", label: "Power (W)" },
    { value: "fanSpeedIn", label: "Fan Speed In" },
    { value: "fanSpeedOut", label: "Fan Speed Out" },
    { value: "poolRejectedPct", label: "Pool Rejected %" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Alert Rules
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-rule">
                <Plus className="w-4 h-4 mr-1" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alert Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Rule Name</Label>
                  <Input
                    id="rule-name"
                    placeholder="e.g. High Temperature Warning"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    data-testid="input-rule-name"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select value={metric} onValueChange={setMetric}>
                      <SelectTrigger data-testid="select-metric">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {metricOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select value={operator} onValueChange={setOperator}>
                      <SelectTrigger data-testid="select-operator">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">">Greater than</SelectItem>
                        <SelectItem value="<">Less than</SelectItem>
                        <SelectItem value=">=">Greater or equal</SelectItem>
                        <SelectItem value="<=">Less or equal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold">Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      placeholder="e.g. 85"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      data-testid="input-threshold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => addMutation.mutate()}
                  disabled={!ruleName || !threshold || addMutation.isPending}
                  data-testid="button-submit-rule"
                >
                  {addMutation.isPending ? "Creating..." : "Create Rule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rules && rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                data-testid={`settings-rule-${rule.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {rule.metric} {rule.operator} {rule.threshold}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    variant={rule.severity === "critical" ? "destructive" : "outline"}
                    className="text-[10px] no-default-active-elevate"
                  >
                    {rule.severity}
                  </Badge>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: rule.id, enabled: checked })
                    }
                    data-testid={`switch-rule-${rule.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-rule-${rule.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No alert rules configured. Create rules to get notified about miner issues.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContainerManagement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rackCount, setRackCount] = useState("8");
  const [slotsPerRack, setSlotsPerRack] = useState("14");
  const [ipRangeStart, setIpRangeStart] = useState("");
  const [ipRangeEnd, setIpRangeEnd] = useState("");

  const { data: containerList, isLoading } = useQuery<ContainerWithSlots[]>({
    queryKey: ["/api/containers"],
  });

  const resetForm = () => {
    setName("");
    setRackCount("8");
    setSlotsPerRack("14");
    setIpRangeStart("");
    setIpRangeEnd("");
    setEditingId(null);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        rackCount: parseInt(rackCount),
        slotsPerRack: parseInt(slotsPerRack),
        ipRangeStart: ipRangeStart || null,
        ipRangeEnd: ipRangeEnd || null,
      };
      if (editingId) {
        await apiRequest("PATCH", `/api/containers/${editingId}`, body);
      } else {
        await apiRequest("POST", "/api/containers", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      setOpen(false);
      resetForm();
      toast({ title: editingId ? "Container updated" : "Container created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save container", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/containers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      toast({ title: "Container removed" });
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/containers/auto-assign");
      return res.json();
    },
    onSuccess: (data: { assigned: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/miners") });
      toast({ title: `Auto-assigned ${data.assigned} miners to slots` });
    },
    onError: (err: Error) => {
      toast({ title: "Auto-assign failed", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (container: Container) => {
    setEditingId(container.id);
    setName(container.name);
    setRackCount(String(container.rackCount));
    setSlotsPerRack(String(container.slotsPerRack));
    setIpRangeStart(container.ipRangeStart || "");
    setIpRangeEnd(container.ipRangeEnd || "");
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Box className="w-4 h-4" />
              Site Builder
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configure containers with racks and slots for physical miner layout
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => autoAssignMutation.mutate()}
              disabled={autoAssignMutation.isPending || !containerList?.length}
              data-testid="button-auto-assign"
            >
              {autoAssignMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
              )}
              Auto-Assign
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-container">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Container
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Container" : "Add Container"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="container-name">Container Name</Label>
                    <Input
                      id="container-name"
                      placeholder="e.g. C1"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-container-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rack-count">Racks per Container</Label>
                      <Input
                        id="rack-count"
                        type="number"
                        min="1"
                        max="50"
                        value={rackCount}
                        onChange={(e) => setRackCount(e.target.value)}
                        data-testid="input-rack-count"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slots-per-rack">Slots per Rack</Label>
                      <Input
                        id="slots-per-rack"
                        type="number"
                        min="1"
                        max="50"
                        value={slotsPerRack}
                        onChange={(e) => setSlotsPerRack(e.target.value)}
                        data-testid="input-slots-per-rack"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ip-range-start">IP Range Start (optional)</Label>
                      <Input
                        id="ip-range-start"
                        placeholder="10.21.29.1"
                        value={ipRangeStart}
                        onChange={(e) => setIpRangeStart(e.target.value)}
                        data-testid="input-container-ip-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ip-range-end">IP Range End (optional)</Label>
                      <Input
                        id="ip-range-end"
                        placeholder="10.21.29.254"
                        value={ipRangeEnd}
                        onChange={(e) => setIpRangeEnd(e.target.value)}
                        data-testid="input-container-ip-end"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    IP range is used for auto-assigning miners to slots. Miners with IPs in this range will be automatically placed in available slots.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => addMutation.mutate()}
                    disabled={!name || !rackCount || !slotsPerRack || addMutation.isPending}
                    data-testid="button-submit-container"
                  >
                    {addMutation.isPending ? "Saving..." : editingId ? "Update Container" : "Add Container"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : containerList && containerList.length > 0 ? (
          <div className="space-y-2">
            {containerList.map((container) => {
              const filledSlots = container.slots.filter((s) => s.minerId).length;
              const totalSlots = container.rackCount * container.slotsPerRack;
              return (
                <div
                  key={container.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                  data-testid={`container-item-${container.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{container.name}</p>
                      <Badge variant="outline" className="text-[10px] no-default-active-elevate">
                        {container.rackCount} racks × {container.slotsPerRack} slots
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] no-default-active-elevate">
                        {filledSlots}/{totalSlots} assigned
                      </Badge>
                    </div>
                    {container.ipRangeStart && container.ipRangeEnd && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        IP range: {container.ipRangeStart} — {container.ipRangeEnd}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(container)}
                      data-testid={`button-edit-container-${container.id}`}
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(container.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-container-${container.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 space-y-2">
            <Box className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No containers configured. Add a container to organize miners by physical location.
            </p>
            <p className="text-xs text-muted-foreground">
              Each container has racks (rows) and slots (positions) — matching your physical layout.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CostSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });

  const [costPerKwh, setCostPerKwh] = useState("");
  const [currency, setCurrency] = useState("$");

  useEffect(() => {
    if (settings) {
      setCostPerKwh(String(settings.electricityCostPerKwh ?? 0.065));
      setCurrency(settings.currencySymbol ?? "$");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/site-settings", {
        electricityCostPerKwh: parseFloat(costPerKwh),
        currencySymbol: currency,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/analytics"] });
      toast({ title: "Cost settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card data-testid="card-cost-settings">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Electricity Cost
        </CardTitle>
        <CardDescription className="text-xs">
          Set your electricity rate for cost calculations on the Analytics page
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="cost-kwh">Cost per kWh</Label>
            <Input
              id="cost-kwh"
              type="number"
              step="0.001"
              min="0"
              value={costPerKwh}
              onChange={(e) => setCostPerKwh(e.target.value)}
              data-testid="input-cost-kwh"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency Symbol</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={5}
              data-testid="input-currency"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          size="sm"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !costPerKwh}
          data-testid="button-save-cost"
        >
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Save Cost Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reset-all-data");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setConfirmText("");
      toast({
        title: "All data cleared",
        description: "All miners, containers, snapshots, alerts, and scan configs have been deleted.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Reset failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-destructive/50" data-testid="card-danger-zone">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete all data. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <h4 className="font-medium text-sm">Reset All Data</h4>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all miners, containers, slot assignments, snapshots, alerts, alert rules, MAC mappings, and scan configs.
            </p>
            <div className="flex items-center gap-3">
              <Input
                placeholder='Type "RESET" to confirm'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="max-w-[200px]"
                data-testid="input-reset-confirm"
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={confirmText !== "RESET" || resetMutation.isPending}
                    data-testid="button-reset-all"
                  >
                    {resetMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL data including miners, containers, snapshots, alerts, and scan configurations. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-reset-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetMutation.mutate()}
                      className="bg-destructive text-destructive-foreground"
                      data-testid="button-reset-confirm"
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
