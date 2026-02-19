import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Settings as SettingsIcon,
} from "lucide-react";
import type { Miner, AlertRule } from "@shared/schema";

export default function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-6 overflow-auto h-full">
      <div>
        <h2 className="text-xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage miners and alert rules
        </p>
      </div>

      <MinerManagement />
      <AlertRuleManagement />
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
                  <p className="text-sm font-medium truncate">{miner.name}</p>
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
