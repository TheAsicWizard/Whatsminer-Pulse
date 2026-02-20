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
  Plus,
  Server,
  Trash2,
  Shield,
  Scan,
  Loader2,
  Wifi,
  WifiOff,
  Radio,
} from "lucide-react";
import type { Miner, AlertRule, ScanConfig, ScanProgress } from "@shared/schema";

export default function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-6 overflow-auto h-full">
      <div>
        <h2 className="text-xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage miners, network scanning, and alert rules
        </p>
      </div>

      <NetworkScanner />
      <MinerManagement />
      <AlertRuleManagement />
    </div>
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

  const { data: configs, isLoading } = useQuery<ScanConfig[]>({
    queryKey: ["/api/scan-configs"],
  });

  const { data: scanProgress } = useQuery<ScanProgress>({
    queryKey: ["/api/scan-configs", scanningConfigId, "progress"],
    enabled: !!scanningConfigId,
    refetchInterval: scanningConfigId ? 1000 : false,
  });

  useEffect(() => {
    if (scanProgress?.status === "completed" || scanProgress?.status === "error") {
      if (scanProgress.status === "completed") {
        toast({ title: `Scan complete`, description: `Found ${scanProgress.found} miners` });
        queryClient.invalidateQueries({ queryKey: ["/api/miners"] });
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

  const isScanning = scanningConfigId !== null && scanProgress?.status === "scanning";

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
      </CardHeader>
      <CardContent>
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
          <div className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                data-testid={`scan-config-${config.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{config.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {config.startIp} — {config.endIp} : {config.port}
                  </p>
                  {config.lastScanResult && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {config.lastScanResult}
                      {config.lastScanAt && (
                        <> · {new Date(config.lastScanAt).toLocaleString()}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scanMutation.mutate(config.id)}
                    disabled={isScanning || scanMutation.isPending}
                    data-testid={`button-scan-${config.id}`}
                  >
                    {scanMutation.isPending && scanMutation.variables === config.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Scan className="w-3.5 h-3.5 mr-1" />
                    )}
                    Scan
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(config.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-config-${config.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
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

function MinerManagement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4028");
  const [location, setLocation] = useState("");
  const [model, setModel] = useState("WhatsMiner");

  const { data: miners, isLoading } = useQuery<Miner[]>({
    queryKey: ["/api/miners"],
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/miners"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/miners"] });
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
