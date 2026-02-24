import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusIndicator, getMinerStatus } from "@/components/status-indicator";
import { formatHashrate, formatPower, formatTemp, formatUptime, formatEfficiency } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Cpu,
  Zap,
  Thermometer,
  Fan,
  Clock,
  Activity,
  TrendingUp,
  Target,
  Gauge,
  StickyNote,
  Save,
  Loader2,
  Terminal,
  RotateCcw,
  PowerOff,
  Settings,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MinerWithLatest, MinerSnapshot } from "@shared/schema";

export default function MinerDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [notesMinerId, setNotesMinerId] = useState<string | null>(null);

  const { data: miner, isLoading } = useQuery<MinerWithLatest>({
    queryKey: ["/api/miners", params.id],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (miner && miner.id !== notesMinerId) {
      setNotes(miner.notes || "");
      setNotesMinerId(miner.id);
    }
  }, [miner, notesMinerId]);

  const notesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/miners/${params.id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/miners", params.id] });
      toast({ title: "Notes saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save notes", description: err.message, variant: "destructive" });
    },
  });

  const { data: history } = useQuery<MinerSnapshot[]>({
    queryKey: ["/api/miners", params.id, "history"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!miner) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Miner not found</p>
        <Link href="/miners">
          <Button variant="outline" size="sm" data-testid="button-back-miners">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Miners
          </Button>
        </Link>
      </div>
    );
  }

  const status = getMinerStatus(miner);
  const s = miner.latest;

  const chartData = history?.map((snap) => ({
    time: new Date(snap.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    hashrate: snap.hashrate ?? 0,
    temperature: snap.temperature ?? 0,
    power: snap.power ?? 0,
    fanIn: snap.fanSpeedIn ?? 0,
    fanOut: snap.fanSpeedOut ?? 0,
  })) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/miners">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} size="lg" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight" data-testid="text-miner-name">
              {miner.name}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              {miner.ipAddress ? (
                <a
                  href={`http://${miner.ipAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500 hover:text-amber-400 underline"
                  data-testid="link-miner-ip"
                >
                  {miner.ipAddress}:{miner.port}
                </a>
              ) : (
                <span>{miner.ipAddress}:{miner.port}</span>
              )}
              {miner.location && ` / ${miner.location}`}
            </p>
            {(miner.macAddress || miner.serialNumber) && (
              <p className="text-[10px] text-muted-foreground font-mono">
                {miner.macAddress && `MAC: ${miner.macAddress}`}
                {miner.macAddress && miner.serialNumber && " / "}
                {miner.serialNumber && `S/N: ${miner.serialNumber}`}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className="ml-auto no-default-active-elevate">
          {miner.model || "WhatsMiner"}
        </Badge>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <DetailStat
              icon={<Cpu className="w-4 h-4" />}
              label="Hashrate"
              value={formatHashrate(s.hashrate ?? 0)}
              accent
            />
            <DetailStat
              icon={<Thermometer className="w-4 h-4" />}
              label="Board Temp"
              value={formatTemp(s.temperature ?? 0)}
              sub={`Env: ${formatTemp(s.envTemp ?? 0)}`}
            />
            <DetailStat
              icon={<Zap className="w-4 h-4" />}
              label="Power"
              value={formatPower(s.power ?? 0)}
              sub={`Limit: ${formatPower(s.powerLimit ?? 3600)}`}
            />
            <DetailStat
              icon={<Fan className="w-4 h-4" />}
              label="Fans"
              value={`${s.fanSpeedIn ?? 0} / ${s.fanSpeedOut ?? 0}`}
              sub="In / Out RPM"
            />
            <DetailStat
              icon={<Clock className="w-4 h-4" />}
              label="Uptime"
              value={formatUptime(s.elapsed ?? 0)}
              sub={`Mode: ${s.powerMode ?? "Normal"}`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DetailStat
              icon={<TrendingUp className="w-4 h-4" />}
              label="Efficiency"
              value={formatEfficiency(s.hashrate ?? 0, s.power ?? 0)}
            />
            <DetailStat
              icon={<Target className="w-4 h-4" />}
              label="Freq"
              value={`${s.freqAvg ?? 0} / ${s.targetFreq ?? 0} MHz`}
              sub="Avg / Target"
            />
            <DetailStat
              icon={<Activity className="w-4 h-4" />}
              label="Accepted"
              value={`${s.accepted ?? 0}`}
              sub={`Rej: ${s.rejected ?? 0}`}
            />
            <DetailStat
              icon={<Gauge className="w-4 h-4" />}
              label="Factory GH/s"
              value={`${((s.factoryGhs ?? 0) / 1000).toFixed(0)} TH/s`}
            />
          </div>

          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Hashrate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(35, 95%, 55%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 20%)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}T`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 22%, 12%)",
                            border: "1px solid hsl(222, 20%, 18%)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "hsl(220, 10%, 92%)",
                          }}
                          formatter={(v: number) => [formatHashrate(v), "Hashrate"]}
                        />
                        <Area type="monotone" dataKey="hashrate" stroke="hsl(35, 95%, 55%)" strokeWidth={2} fill="url(#hashGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Temperature & Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 20%)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}°`} />
                        <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}W`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 22%, 12%)",
                            border: "1px solid hsl(222, 20%, 18%)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "hsl(220, 10%, 92%)",
                          }}
                        />
                        <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="hsl(0, 84%, 55%)" strokeWidth={2} dot={false} />
                        <Line yAxisId="power" type="monotone" dataKey="power" stroke="hsl(200, 82%, 60%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No telemetry data available for this miner</p>
          </CardContent>
        </Card>
      )}

      <MinerCommandPanel minerId={miner.id} minerIp={miner.ipAddress} minerSource={miner.source} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add notes about this miner (maintenance history, issues, etc.)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px] text-sm"
            data-testid="input-miner-notes"
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={() => notesMutation.mutate()}
            disabled={notesMutation.isPending}
            data-testid="button-save-notes"
          >
            {notesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save Notes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailStat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-base font-semibold font-mono tracking-tight ${accent ? "text-primary" : ""}`}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

type CommandDef = {
  id: string;
  label: string;
  description: string;
  dangerous: boolean;
  requiresParams: boolean;
};

type CommandLogEntry = {
  id: number;
  command: string;
  label: string;
  success: boolean;
  message: string;
  simulated?: boolean;
  timestamp: Date;
  data?: any;
};

function MinerCommandPanel({ minerId, minerIp, minerSource }: { minerId: string; minerIp: string; minerSource: string }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ command: CommandDef; params?: any } | null>(null);
  const [poolUrl, setPoolUrl] = useState("");
  const [poolWorker, setPoolWorker] = useState("");
  const [poolPassword, setPoolPassword] = useState("x");
  const [powerPct, setPowerPct] = useState("100");
  const [targetFreq, setTargetFreq] = useState("600");
  const [apiPassword, setApiPassword] = useState("admin");
  const [showPoolDialog, setShowPoolDialog] = useState(false);
  const [showPowerDialog, setShowPowerDialog] = useState(false);
  const [showFreqDialog, setShowFreqDialog] = useState(false);
  const logCounter = useRef(0);

  const { data: commands } = useQuery<CommandDef[]>({
    queryKey: ["/api/miner-commands"],
  });

  const sendCommand = useMutation({
    mutationFn: async ({ command, params }: { command: string; params?: any }) => {
      const resp = await apiRequest("POST", `/api/miners/${minerId}/command`, {
        command,
        params,
        apiPassword: apiPassword || undefined,
      });
      return resp.json();
    },
    onSuccess: (data, variables) => {
      const cmd = commands?.find((c) => c.id === variables.command);
      const entry: CommandLogEntry = {
        id: ++logCounter.current,
        command: variables.command,
        label: cmd?.label || variables.command,
        success: data.success,
        message: data.message,
        simulated: data.simulated,
        timestamp: new Date(),
        data: data.data,
      };
      setCommandLog((prev) => [entry, ...prev].slice(0, 50));

      if (!data.success && entry.data) {
        setExpandedLogId(entry.id);
      }

      if (data.success) {
        toast({ title: entry.label, description: data.message });
      } else {
        toast({ title: `${entry.label} failed`, description: data.message, variant: "destructive" });
      }
      setConfirmDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Command failed", description: err.message, variant: "destructive" });
      setConfirmDialog(null);
    },
  });

  const handleCommand = (cmd: CommandDef) => {
    if (cmd.id === "update_pools") {
      setShowPoolDialog(true);
      return;
    }
    if (cmd.id === "set_power_pct") {
      setShowPowerDialog(true);
      return;
    }
    if (cmd.id === "set_target_freq") {
      setShowFreqDialog(true);
      return;
    }
    if (cmd.dangerous) {
      setConfirmDialog({ command: cmd });
      return;
    }
    sendCommand.mutate({ command: cmd.id });
  };

  const quickCommands = commands?.filter((c) => !c.requiresParams && !c.dangerous) || [];
  const configCommands = commands?.filter((c) => c.requiresParams) || [];
  const dangerCommands = commands?.filter((c) => c.dangerous) || [];

  const cmdIcon = (id: string) => {
    switch (id) {
      case "restart": return <RotateCcw className="w-3.5 h-3.5" />;
      case "power_off": return <PowerOff className="w-3.5 h-3.5" />;
      case "set_power_pct": return <Zap className="w-3.5 h-3.5" />;
      case "update_pools": return <Server className="w-3.5 h-3.5" />;
      case "set_target_freq": return <Target className="w-3.5 h-3.5" />;
      case "get_psu": return <Zap className="w-3.5 h-3.5" />;
      case "get_version": return <Settings className="w-3.5 h-3.5" />;
      case "summary": return <Cpu className="w-3.5 h-3.5" />;
      default: return <Terminal className="w-3.5 h-3.5" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setExpanded(!expanded)}
            data-testid="button-toggle-commands"
          >
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Miner Commands
              {minerSource === "simulation" && (
                <Badge variant="outline" className="text-[9px] ml-1 no-default-active-elevate">
                  Simulated
                </Badge>
              )}
            </CardTitle>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {expanded && (
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 max-w-[200px]">
                <Label className="text-[10px] text-muted-foreground">API Password</Label>
                <Input
                  type="password"
                  value={apiPassword}
                  onChange={(e) => setApiPassword(e.target.value)}
                  placeholder="admin"
                  className="h-7 text-xs"
                  data-testid="input-api-password"
                />
              </div>
              <p className="text-[10px] text-muted-foreground pb-1.5">
                Required for write commands on newer firmware
              </p>
            </div>

            {quickCommands.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quick Commands</p>
                <div className="flex flex-wrap gap-2">
                  {quickCommands.map((cmd) => (
                    <Button
                      key={cmd.id}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => handleCommand(cmd)}
                      disabled={sendCommand.isPending}
                      data-testid={`button-cmd-${cmd.id}`}
                    >
                      {sendCommand.isPending && sendCommand.variables?.command === cmd.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : cmdIcon(cmd.id)}
                      {cmd.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {configCommands.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Configuration</p>
                <div className="flex flex-wrap gap-2">
                  {configCommands.map((cmd) => (
                    <Button
                      key={cmd.id}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => handleCommand(cmd)}
                      disabled={sendCommand.isPending}
                      data-testid={`button-cmd-${cmd.id}`}
                    >
                      {cmdIcon(cmd.id)}
                      {cmd.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {dangerCommands.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Dangerous</p>
                <div className="flex flex-wrap gap-2">
                  {dangerCommands.map((cmd) => (
                    <Button
                      key={cmd.id}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => handleCommand(cmd)}
                      disabled={sendCommand.isPending}
                      data-testid={`button-cmd-${cmd.id}`}
                    >
                      {sendCommand.isPending && sendCommand.variables?.command === cmd.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : cmdIcon(cmd.id)}
                      {cmd.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {commandLog.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Command Log</p>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {commandLog.map((entry) => {
                    const isExpanded = expandedLogId === entry.id;
                    const hasData = entry.data && Object.keys(entry.data).length > 0;
                    return (
                      <div
                        key={entry.id}
                        className="text-xs rounded bg-muted/30 border border-border/50 overflow-hidden"
                        data-testid={`log-entry-${entry.id}`}
                      >
                        <button
                          className="flex items-start gap-2 p-2 w-full text-left hover:bg-muted/50 transition-colors"
                          onClick={() => hasData && setExpandedLogId(isExpanded ? null : entry.id)}
                          data-testid={`button-expand-log-${entry.id}`}
                        >
                          {entry.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{entry.label}</span>
                              {entry.simulated && (
                                <Badge variant="outline" className="text-[8px] h-3.5 no-default-active-elevate">SIM</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground truncate">{entry.message}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            {hasData && (
                              isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        {isExpanded && hasData && (
                          <div className="px-3 pb-2 border-t border-border/30">
                            <CommandResponseData data={entry.data} command={entry.command} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm {confirmDialog?.command.label}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.command.description}. This will be sent to miner at {minerIp}.
              Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} data-testid="button-cancel-command">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDialog && sendCommand.mutate({ command: confirmDialog.command.id, params: confirmDialog.params })}
              disabled={sendCommand.isPending}
              data-testid="button-confirm-command"
            >
              {sendCommand.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPoolDialog} onOpenChange={setShowPoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Mining Pool</DialogTitle>
            <DialogDescription>Set the pool URL, worker name, and password for this miner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pool URL</Label>
              <Input
                value={poolUrl}
                onChange={(e) => setPoolUrl(e.target.value)}
                placeholder="stratum+tcp://pool.example.com:3333"
                className="text-sm"
                data-testid="input-pool-url"
              />
            </div>
            <div>
              <Label className="text-xs">Worker Name</Label>
              <Input
                value={poolWorker}
                onChange={(e) => setPoolWorker(e.target.value)}
                placeholder="account.worker1"
                className="text-sm"
                data-testid="input-pool-worker"
              />
            </div>
            <div>
              <Label className="text-xs">Pool Password</Label>
              <Input
                value={poolPassword}
                onChange={(e) => setPoolPassword(e.target.value)}
                placeholder="x"
                className="text-sm"
                data-testid="input-pool-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPoolDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                sendCommand.mutate({
                  command: "update_pools",
                  params: { pool1: poolUrl, worker1: poolWorker, passwd1: poolPassword },
                });
                setShowPoolDialog(false);
              }}
              disabled={!poolUrl || !poolWorker || sendCommand.isPending}
              data-testid="button-send-pool-update"
            >
              {sendCommand.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Update Pool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPowerDialog} onOpenChange={setShowPowerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Power Mode</DialogTitle>
            <DialogDescription>Set the power percentage for this miner. 100% is normal operation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Power Percentage</Label>
              <Select value={powerPct} onValueChange={setPowerPct}>
                <SelectTrigger data-testid="select-power-pct">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20% — Ultra Low Power</SelectItem>
                  <SelectItem value="40">40% — Low Power</SelectItem>
                  <SelectItem value="60">60% — Eco Mode</SelectItem>
                  <SelectItem value="80">80% — Balanced</SelectItem>
                  <SelectItem value="100">100% — Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPowerDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                sendCommand.mutate({
                  command: "set_power_pct",
                  params: { percent: parseInt(powerPct) },
                });
                setShowPowerDialog(false);
              }}
              disabled={sendCommand.isPending}
              data-testid="button-send-power-pct"
            >
              Set Power
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFreqDialog} onOpenChange={setShowFreqDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Target Frequency</DialogTitle>
            <DialogDescription>Set the target mining frequency in MHz. Higher values increase hashrate but also power and heat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Target Frequency (MHz)</Label>
              <Input
                type="number"
                value={targetFreq}
                onChange={(e) => setTargetFreq(e.target.value)}
                placeholder="600"
                min={100}
                max={1000}
                className="text-sm"
                data-testid="input-target-freq"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Typical range: 400-800 MHz</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFreqDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                sendCommand.mutate({
                  command: "set_target_freq",
                  params: { freq: parseInt(targetFreq) },
                });
                setShowFreqDialog(false);
              }}
              disabled={sendCommand.isPending}
              data-testid="button-send-target-freq"
            >
              Set Frequency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatResponseValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value > 1000) return value.toLocaleString();
    return String(value);
  }
  return String(value);
}

function CommandResponseData({ data, command }: { data: any; command: string }) {
  const summaryKeys: Record<string, string> = {
    "GHS av": "Hashrate (GH/s)",
    "GHS 5s": "Hashrate 5s (GH/s)",
    "MHS av": "Hashrate (MH/s)",
    Temperature: "Temperature (°C)",
    Elapsed: "Uptime (s)",
    "Factory GHS": "Factory GH/s",
    "Power": "Power (W)",
    "Power Limit": "Power Limit (W)",
    Accepted: "Accepted Shares",
    Rejected: "Rejected Shares",
    "Fan Speed In": "Fan In (RPM)",
    "Fan Speed Out": "Fan Out (RPM)",
    "Pool Rejected%": "Pool Reject %",
    "Pool Stale%": "Pool Stale %",
    "Freq avg": "Avg Frequency (MHz)",
    "Power Mode": "Power Mode",
  };

  const psuKeys: Record<string, string> = {
    Model: "PSU Model",
    model: "PSU Model",
    name: "PSU Model",
    FanSpeed: "Fan Speed (RPM)",
    fan_speed: "Fan Speed (RPM)",
    Vin: "Input Voltage (V)",
    vin: "Input Voltage (V)",
    Vout: "Output Voltage (V)",
    vout: "Output Voltage (V)",
    Iin: "Input Current (A)",
    iin: "Input Current (A)",
    Iout: "Output Current (A)",
    iout: "Output Current (A)",
    Pin: "Input Power (W)",
    pin: "Input Power (W)",
    Pout: "Output Power (W)",
    pout: "Output Power (W)",
    "PSU Temp": "PSU Temperature (°C)",
    temp: "PSU Temperature (°C)",
    temp0: "Temp 0 (°C)",
    temp1: "Temp 1 (°C)",
    sernum: "Serial Number",
    hw_version: "HW Version",
    sw_version: "SW Version",
  };

  const versionKeys: Record<string, string> = {
    Type: "Miner Type",
    type: "Miner Type",
    CompileTime: "Firmware Date",
    compiletime: "Firmware Date",
    API: "API Version",
    api: "API Version",
    Miner: "Miner Version",
    miner: "Miner Version",
    "Firmware Version": "Firmware Version",
    fw_ver: "Firmware Version",
    "CGMiner": "CGMiner Version",
  };

  function findSection(d: any): { keyMap: Record<string, string>; section: any } | null {
    if (command === "summary") {
      const s = d.SUMMARY || d.summary;
      if (s) return { keyMap: summaryKeys, section: Array.isArray(s) ? s[0] : s };
      if (d.Msg && typeof d.Msg === "object" && !Array.isArray(d.Msg)) {
        const hasKeys = Object.keys(d.Msg).some(k => k in summaryKeys || k.toLowerCase() in summaryKeys);
        if (hasKeys) return { keyMap: summaryKeys, section: d.Msg };
      }
    }
    if (command === "get_psu") {
      const p = d.PSU || d.psu;
      if (p) return { keyMap: psuKeys, section: Array.isArray(p) ? p[0] : p };
      if (d.Msg && typeof d.Msg === "object" && !Array.isArray(d.Msg)) {
        return { keyMap: psuKeys, section: d.Msg };
      }
    }
    if (command === "get_version") {
      const v = d.VERSION || d.version;
      if (v) return { keyMap: versionKeys, section: Array.isArray(v) ? v[0] : v };
      if (d.Msg && typeof d.Msg === "object" && !Array.isArray(d.Msg)) {
        return { keyMap: versionKeys, section: d.Msg };
      }
    }
    return null;
  }

  const found = findSection(data);

  if (found && found.section && typeof found.section === "object") {
    const seen = new Set<string>();
    const entries = Object.entries(found.section)
      .filter(([k]) => {
        const label = found.keyMap[k];
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
      })
      .map(([k, v]) => ({ label: found.keyMap[k], value: v }));

    if (entries.length > 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pt-2" data-testid="response-data-grid">
          {entries.map(({ label, value }) => (
            <div key={label} className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
              <span className="font-mono font-medium text-xs">{formatResponseValue(value)}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  if (typeof data === "object" && data !== null) {
    const flat = flattenForDisplay(data);
    if (flat.length > 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pt-2" data-testid="response-data-flat">
          {flat.map(({ key, value }) => (
            <div key={key} className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{key}</span>
              <span className="font-mono font-medium text-xs">{formatResponseValue(value)}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <pre className="pt-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto" data-testid="response-data-raw">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function flattenForDisplay(obj: any, prefix = ""): { key: string; value: any }[] {
  const result: { key: string; value: any }[] = [];
  const skip = new Set(["STATUS", "status", "id", "Id", "ID", "When", "Code", "Description"]);
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k)) continue;
    const label = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flattenForDisplay(v, label));
    } else if (Array.isArray(v) && v.length === 1 && typeof v[0] === "object") {
      result.push(...flattenForDisplay(v[0], label));
    } else {
      result.push({ key: label, value: v });
    }
  }
  return result;
}

