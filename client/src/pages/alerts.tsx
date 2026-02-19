import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import type { Alert } from "@shared/schema";

export default function Alerts() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 5000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/alerts/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/alerts/acknowledge-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
  });

  const unacknowledged = alerts?.filter((a) => !a.acknowledged) ?? [];
  const acknowledged = alerts?.filter((a) => a.acknowledged) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" data-testid="text-alerts-title">
            Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            {unacknowledged.length} active alert{unacknowledged.length !== 1 ? "s" : ""}
          </p>
        </div>
        {unacknowledged.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => acknowledgeAllMutation.mutate()}
            disabled={acknowledgeAllMutation.isPending}
            data-testid="button-acknowledge-all"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Acknowledge All
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {unacknowledged.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active
              </h3>
              {unacknowledged.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                  isPending={acknowledgeMutation.isPending}
                />
              ))}
            </div>
          )}

          {acknowledged.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
                Acknowledged
              </h3>
              {acknowledged.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          )}

          {alerts && alerts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No alerts yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Alerts will appear here when miners trigger threshold rules
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  onAcknowledge,
  isPending,
}: {
  alert: Alert;
  onAcknowledge?: () => void;
  isPending?: boolean;
}) {
  const severityIcon = {
    critical: <XCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
  };

  const severityBadge = {
    critical: "destructive" as const,
    warning: "default" as const,
    info: "secondary" as const,
  };

  return (
    <Card
      className={alert.acknowledged ? "opacity-60" : ""}
      data-testid={`alert-${alert.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {severityIcon[alert.severity as keyof typeof severityIcon] || severityIcon.info}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{alert.message}</p>
              <Badge
                variant={severityBadge[alert.severity as keyof typeof severityBadge] || "secondary"}
                className="text-[10px] no-default-active-elevate"
              >
                {alert.severity}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {alert.createdAt ? timeAgo(alert.createdAt) : "Unknown time"}
            </p>
          </div>
          {!alert.acknowledged && onAcknowledge && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAcknowledge}
              disabled={isPending}
              data-testid={`button-ack-${alert.id}`}
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
