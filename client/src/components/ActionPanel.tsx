// Design: Dark terminal — action items with priority color coding
import { motion } from "framer-motion";
import { ActionItem } from "@/lib/data";
import { AlertTriangle, TrendingUp, Settings, FlaskConical, Pause, Zap } from "lucide-react";

interface ActionPanelProps {
  items: ActionItem[];
}

const priorityConfig = {
  critical: {
    color: "#FF3B5C",
    bg: "rgba(255, 59, 92, 0.08)",
    border: "rgba(255, 59, 92, 0.2)",
    label: "CRITICAL",
    icon: AlertTriangle,
  },
  high: {
    color: "#FFB300",
    bg: "rgba(255, 179, 0, 0.08)",
    border: "rgba(255, 179, 0, 0.2)",
    label: "HIGH",
    icon: Zap,
  },
  medium: {
    color: "#00D4FF",
    bg: "rgba(0, 212, 255, 0.06)",
    border: "rgba(0, 212, 255, 0.15)",
    label: "MEDIUM",
    icon: Settings,
  },
};

const categoryIcon = {
  pause: Pause,
  scale: TrendingUp,
  optimize: Settings,
  test: FlaskConical,
};

const categoryLabel = {
  pause: "Pause",
  scale: "Scale",
  optimize: "Optimize",
  test: "Test",
};

export default function ActionPanel({ items }: ActionPanelProps) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pConfig = priorityConfig[item.priority];
        const CatIcon = categoryIcon[item.category];

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-lg p-4 transition-all duration-200 hover:brightness-110"
            style={{
              background: pConfig.bg,
              border: `1px solid ${pConfig.border}`,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Priority indicator */}
              <div
                className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
                style={{ background: `${pConfig.color}18`, color: pConfig.color }}
              >
                <CatIcon size={14} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded"
                    style={{ color: pConfig.color, background: `${pConfig.color}18` }}
                  >
                    {pConfig.label}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color: "#64748B", background: "rgba(255,255,255,0.04)" }}
                  >
                    {categoryLabel[item.category]}
                  </span>
                </div>
                <h4
                  className="text-sm font-semibold mb-1 leading-snug"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E2E8F0" }}
                >
                  {item.title}
                </h4>
                <p className="text-xs leading-relaxed mb-2" style={{ color: "#64748B" }}>
                  {item.description}
                </p>
                <div
                  className="text-xs font-medium px-2 py-1 rounded inline-flex items-center gap-1"
                  style={{ color: "#00E676", background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0,230,118,0.15)" }}
                >
                  <TrendingUp size={10} />
                  {item.estimatedImpact}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
