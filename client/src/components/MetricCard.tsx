// Design: Dark terminal — glowing cyan metric cards with JetBrains Mono numbers
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  accent?: "cyan" | "win" | "warn" | "loss" | "neutral";
  delay?: number;
}

const accentMap = {
  cyan: {
    border: "rgba(0, 212, 255, 0.2)",
    glow: "rgba(0, 212, 255, 0.06)",
    text: "#00D4FF",
    dot: "#00D4FF",
  },
  win: {
    border: "rgba(0, 230, 118, 0.2)",
    glow: "rgba(0, 230, 118, 0.06)",
    text: "#00E676",
    dot: "#00E676",
  },
  warn: {
    border: "rgba(255, 179, 0, 0.2)",
    glow: "rgba(255, 179, 0, 0.06)",
    text: "#FFB300",
    dot: "#FFB300",
  },
  loss: {
    border: "rgba(255, 59, 92, 0.2)",
    glow: "rgba(255, 59, 92, 0.06)",
    text: "#FF3B5C",
    dot: "#FF3B5C",
  },
  neutral: {
    border: "rgba(255,255,255,0.08)",
    glow: "rgba(255,255,255,0.02)",
    text: "#E2E8F0",
    dot: "#64748B",
  },
};

export default function MetricCard({
  label,
  value,
  subValue,
  icon,
  accent = "cyan",
  delay = 0,
}: MetricCardProps) {
  const colors = accentMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="relative rounded-lg p-4 overflow-hidden group transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, ${colors.glow} 0%, rgba(13,15,20,0.8) 60%)`,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 0 ${colors.glow}`,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.dot}, transparent)` }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>
            {label}
          </p>
          <p
            className="metric-number text-2xl font-semibold leading-none truncate"
            style={{ color: colors.text }}
          >
            {value}
          </p>
          {subValue && (
            <p className="text-xs mt-1.5" style={{ color: "#475569" }}>
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: colors.glow, color: colors.dot }}
          >
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
