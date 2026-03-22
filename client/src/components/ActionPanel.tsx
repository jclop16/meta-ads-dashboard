// Design: Dark terminal — action items with priority color coding
// Now supports DB-backed items with completed toggle
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Settings, FlaskConical, Pause, Zap, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

// DB-typed action item (from server)
interface DbActionItem {
  id: number;
  priority: "critical" | "high" | "medium";
  category: "pause" | "scale" | "optimize" | "test";
  title: string;
  description: string;
  estimatedImpact: string;
  completed: boolean;
}

interface ActionPanelProps {
  items: DbActionItem[];
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
  const utils = trpc.useUtils();
  const toggleMutation = trpc.dashboard.toggleActionItem.useMutation({
    onSuccess: () => utils.dashboard.actionItems.invalidate(),
  });

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pConfig = priorityConfig[item.priority];
        const CatIcon = categoryIcon[item.category];

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-lg p-4 transition-all duration-200 hover:brightness-110"
            style={{
              background: item.completed ? "rgba(0,230,118,0.04)" : pConfig.bg,
              border: `1px solid ${item.completed ? "rgba(0,230,118,0.2)" : pConfig.border}`,
              opacity: item.completed ? 0.65 : 1,
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
                    style={{ color: "var(--dash-muted)", background: "var(--dash-panel-soft)" }}
                  >
                    {categoryLabel[item.category]}
                  </span>
                  {item.completed && (
                    <span
                      className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ color: "#00E676", background: "rgba(0,230,118,0.1)" }}
                    >
                      <CheckCircle2 size={9} /> DONE
                    </span>
                  )}
                </div>
                <h4
                  className="text-sm font-semibold mb-1 leading-snug"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: item.completed ? "var(--dash-subtle)" : "var(--dash-text)",
                    textDecoration: item.completed ? "line-through" : "none",
                  }}
                >
                  {item.title}
                </h4>
                <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--dash-muted)" }}>
                  {item.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="text-xs font-medium px-2 py-1 rounded inline-flex items-center gap-1"
                    style={{ color: "#00E676", background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0,230,118,0.15)" }}
                  >
                    <TrendingUp size={10} />
                    {item.estimatedImpact}
                  </div>
                  {/* Toggle completed button */}
                  <button
                    onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })}
                    disabled={toggleMutation.isPending}
                    className="text-[10px] font-mono px-2 py-1 rounded transition-all hover:brightness-125"
                    style={{
                      color: item.completed ? "var(--dash-muted)" : "#00D4FF",
                      background: item.completed ? "var(--dash-panel-soft)" : "color-mix(in srgb, var(--color-cyan) 6%, var(--dash-panel))",
                      border: `1px solid ${item.completed ? "var(--dash-border)" : "color-mix(in srgb, var(--color-cyan) 15%, var(--dash-border))"}`,
                    }}
                  >
                    {item.completed ? "↩ Undo" : "✓ Mark done"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
