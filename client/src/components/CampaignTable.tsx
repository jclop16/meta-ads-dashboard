// Design: Dark terminal — dense data table with color-coded performance rows
// CPL coloring is driven by the user-defined CplTargetContext threshold
import { useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DashboardCampaign } from "@/lib/dashboardTypes";
import StatusBadge from "./StatusBadge";
import { useCplTarget } from "@/contexts/CplTargetContext";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface CampaignTableProps {
  campaigns: DashboardCampaign[];
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number) {
  return `$${fmt(n)}`;
}

export default function CampaignTable({ campaigns }: CampaignTableProps) {
  const { getColor, cplTarget } = useCplTarget();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof DashboardCampaign>("amountSpent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(key: keyof DashboardCampaign) {
    if (sortKey === key) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: keyof DashboardCampaign }) {
    if (sortKey !== k) return <span className="opacity-20 text-xs">↕</span>;
    return sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />;
  }

  const rowBgMap = {
    excellent: "rgba(0, 230, 118, 0.04)",
    moderate: "rgba(255, 179, 0, 0.03)",
    poor: "rgba(255, 59, 92, 0.06)",
  };
  const rowBarMap = {
    excellent: "#00E676",
    moderate: "#FFB300",
    poor: "#FF3B5C",
  };

  const thClass =
    "px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest cursor-pointer select-none whitespace-nowrap hover:text-cyan transition-colors";
  const tdClass = "px-3 py-3 text-sm font-mono whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--dash-border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--dash-panel-soft)", borderBottom: "1px solid var(--dash-border)" }}>
            <th className={`${thClass} min-w-[200px]`} style={{ color: "var(--dash-subtle)" }}>
              Campaign
            </th>
            {[
              { label: "Status", key: null },
              { label: "Spent", key: "amountSpent" as keyof DashboardCampaign },
              { label: "Impressions", key: "impressions" as keyof DashboardCampaign },
              { label: "Leads", key: "leads" as keyof DashboardCampaign },
              { label: `CPL (target: $${cplTarget.toFixed(2)})`, key: "costPerLead" as keyof DashboardCampaign },
              { label: "CTR (all)", key: "ctrAll" as keyof DashboardCampaign },
              { label: "CTR (link)", key: "ctrLink" as keyof DashboardCampaign },
              { label: "CPM", key: "cpm" as keyof DashboardCampaign },
              { label: "Freq", key: "frequency" as keyof DashboardCampaign },
            ].map(col => (
              <th
                key={col.label}
                className={`${thClass} text-right`}
                style={{ color: sortKey === col.key ? "#00D4FF" : "var(--dash-subtle)" }}
                onClick={() => col.key && toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  {col.label}
                  {col.key && <SortIcon k={col.key} />}
                </span>
              </th>
            ))}
            <th className={`${thClass} text-center`} style={{ color: "var(--dash-subtle)" }}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => {
            const dynStatus = c.performanceStatus;
            const dynColor = getColor(c.costPerLead);
            const rowBg = rowBgMap[dynStatus];
            const barColor = rowBarMap[dynStatus];

            return (
              <Fragment key={c.id}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group transition-all duration-150 cursor-pointer"
                  style={{
                    background: expanded === c.id ? rowBg : "transparent",
                    borderBottom: "1px solid var(--dash-border)",
                  }}
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0 transition-colors duration-300"
                        style={{ background: barColor, opacity: 0.7 }}
                      />
                      <span
                        className="text-sm font-medium leading-snug"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
                      >
                        {c.displayName ?? c.shortName}
                      </span>
                    </div>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <StatusBadge status={dynStatus} size="sm" />
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text)" }}>
                    {fmtCurrency(c.amountSpent)}
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text-soft)" }}>
                    {c.impressions.toLocaleString()}
                  </td>
                  <td className={`${tdClass} text-right font-bold`} style={{ color: "var(--dash-text)" }}>
                    {c.leads}
                  </td>
                  <td className={`${tdClass} text-right font-bold transition-colors duration-300`} style={{ color: dynColor }}>
                    {c.costPerLead !== null ? fmtCurrency(c.costPerLead) : "N/A"}
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text-soft)" }}>
                    {fmt(c.ctrAll)}%
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text-soft)" }}>
                    {fmt(c.ctrLink)}%
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text-soft)" }}>
                    {fmtCurrency(c.cpm)}
                  </td>
                  <td className={`${tdClass} text-right`} style={{ color: "var(--dash-text-soft)" }}>
                    {fmt(c.frequency, 2)}×
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span style={{ color: "var(--dash-subtle)" }}>
                      {expanded === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </td>
                </motion.tr>

                <AnimatePresence>
                  {expanded === c.id && (
                    <motion.tr
                      key={`${c.id}-detail`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <td
                        colSpan={11}
                        className="px-4 py-3"
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid var(--dash-border)",
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--dash-subtle)" }} />
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: "var(--dash-text-soft)", fontFamily: "'Space Grotesk', sans-serif" }}>
                              Recommendation
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--dash-muted)" }}>
                              {c.recommendation}
                            </p>
                            <div className="flex gap-4 mt-2 flex-wrap">
                              <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                                Performance Score:{" "}
                                <span style={{ color: "var(--dash-text-soft)" }}>{c.performanceScore}/100</span>
                              </span>
                              <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                                CPL vs Target:{" "}
                                <span style={{ color: dynColor, fontWeight: 600 }}>
                                  {c.costPerLead !== null
                                    ? `$${c.costPerLead.toFixed(2)} (${c.costPerLead <= cplTarget ? "✓ on target" : `$${(c.costPerLead - cplTarget).toFixed(2)} over`})`
                                    : "N/A"}
                                </span>
                              </span>
                              <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                                Reach: <span style={{ color: "var(--dash-text-soft)" }}>{c.reach.toLocaleString()} accounts</span>
                              </span>
                              <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                                Link Clicks: <span style={{ color: "var(--dash-text-soft)" }}>{c.linkClicks.toLocaleString()}</span>
                              </span>
                              <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                                CPC (link): <span style={{ color: "var(--dash-text-soft)" }}>{fmtCurrency(c.cpcLink)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
