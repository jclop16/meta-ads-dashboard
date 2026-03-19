// Design: Dark terminal — pill-shaped performance status badges
// Status is driven dynamically by CplTargetContext throughout the dashboard
import type { PerformanceStatus } from "@/lib/dashboardTypes";

interface StatusBadgeProps {
  status: PerformanceStatus;
  size?: "sm" | "md";
}

const statusConfig = {
  excellent: {
    label: "On Target",
    className: "status-win",
    dot: "#00E676",
  },
  moderate: {
    label: "Moderate",
    className: "status-warn",
    dot: "#FFB300",
  },
  poor: {
    label: "Over Target",
    className: "status-loss",
    dot: "#FF3B5C",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold font-mono uppercase tracking-wider ${sizeClass} ${config.className}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: config.dot, boxShadow: `0 0 4px ${config.dot}` }}
      />
      {config.label}
    </span>
  );
}
