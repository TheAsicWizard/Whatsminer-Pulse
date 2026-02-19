export function formatHashrate(ghs: number): string {
  if (ghs >= 1000000) return `${(ghs / 1000000).toFixed(2)} PH/s`;
  if (ghs >= 1000) return `${(ghs / 1000).toFixed(2)} TH/s`;
  return `${ghs.toFixed(2)} GH/s`;
}

export function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${watts} W`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatTemp(temp: number): string {
  return `${temp.toFixed(1)}°C`;
}

export function formatEfficiency(ghs: number, watts: number): string {
  if (watts === 0) return "-- J/TH";
  const ths = ghs / 1000;
  if (ths === 0) return "-- J/TH";
  return `${(watts / ths).toFixed(1)} J/TH`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
