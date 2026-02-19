import { cn } from "@/lib/utils";

type Status = "online" | "warning" | "critical" | "offline";

interface StatusIndicatorProps {
  status: Status;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<Status, { color: string; label: string; pulse: boolean }> = {
  online: { color: "bg-emerald-500", label: "Online", pulse: true },
  warning: { color: "bg-amber-500", label: "Warning", pulse: true },
  critical: { color: "bg-red-500", label: "Critical", pulse: true },
  offline: { color: "bg-gray-400 dark:bg-gray-600", label: "Offline", pulse: false },
};

const sizeMap = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

export function StatusIndicator({ status, size = "md", showLabel = false, className }: StatusIndicatorProps) {
  const config = statusConfig[status];
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="relative flex">
        {config.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping", config.color)} />
        )}
        <span className={cn("relative inline-flex rounded-full", config.color, sizeMap[size])} />
      </span>
      {showLabel && (
        <span className="text-xs text-muted-foreground capitalize">{config.label}</span>
      )}
    </div>
  );
}

export function getMinerStatus(miner: { status: string }): Status {
  switch (miner.status) {
    case "online":
      return "online";
    case "warning":
      return "warning";
    case "critical":
      return "critical";
    default:
      return "offline";
  }
}
