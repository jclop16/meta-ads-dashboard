// Design: Dark terminal — dense data table with color-coded performance rows
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Campaign } from "@/lib/data";
import StatusBadge from "./StatusBadge";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface CampaignTableProps {
  campaigns: Campaign[];
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number) {
  return `$${fmt(n)}`;
}

const rowAccent = {
  excellent: "rgba(0, 230, 118, 0.04)",
  moderate: "rgba(255, 179, 0, 0.03)",
  poor: "rgba(255, 59, 92, 0.06)",
};

const rowBorder = {
  excellent: "rgba(0, 230, 118, 0.12)",
  moderate: "rgba(255, 179, 0, 0.08)",
  poor: "rgba(255, 59, 92, 0.15)",
};

export default function CampaignTable({ campaigns }: CampaignTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof Campaign>("amountSpent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(key: keyof Campaign) {
    if (sortKey === key) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: keyof Campaign }) {
    if (sortKey !== k) return <span className="opacity-20 text-xs">↕</span>;
    return sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />;
  }

  const thClass =
    "px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest cursor-pointer select-none whitespace-nowrap hover:text-cyan transition-colors";
  const tdClass = "px-3 py-3 text-sm font-mono whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th className={`${thClass} min-w-[200px]`} style={{ color: "#475569" }}>
              Campaign
            </th>
            {[
              { label: "Status", key: null },
              { label: "Spent", key: "amountSpent" as keyof Campaign },
              { label: "Impressions", key: "impressions" as keyof Campaign },
              { label: "Leads", key: "leads" as keyof Campaign },
              { label: "CPL", key: "costPerLead" as keyof Campaign },
              { label: "CTR (all)", key: "ctrAll" as keyof Campaign },
              { label: "CTR (link)", key: "ctrLink" as keyof Campaign },
              { label: "CPM", key: "cpm" as keyof Campaign },
              { label: "Freq", key: "frequency" as keyof Campaign },
            ].map(col => (
              <th
                key={col.label}
                className={`${thClass} text-right`}
                style={{ color: sortKey === col.key ? "#00D4FF" : "#475569" }}
                onClick={() => col.key && toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  {col.label}
                  {col.key && <SortIcon k={col.key} />}
                </span>
              </th>
            ))}
            <th className={`${thClass} text-center`} style={{ color: "#475569" }}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <>
              <motion.tr
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="group transition-all duration-150 cursor-pointer"
                style={{
                  background: expanded === c.id ? rowAccent[c.status] : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ background: rowBorder[c.status] === "rgba(0, 230, 118, 0.12)" ? "#00E676" : c.status === "poor" ? "#FF3B5C" : "#FFB300", opacity: 0.6 }}
                    />
                    <span
                      className="text-sm font-medium leading-snug"
                      style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1" }}
                    >
                      {c.shortName}
                    </span>
                  </div>
                </td>
                <td className={`${tdClass} text-right`}>
                  <StatusBadge status={c.status} size="sm" />
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#E2E8F0" }}>
                  {fmtCurrency(c.amountSpent)}
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#94A3B8" }}>
                  {c.impressions.toLocaleString()}
                </td>
                <td className={`${tdClass} text-right font-bold`} style={{ color: "#E2E8F0" }}>
                  {c.leads}
                </td>
                <td className={`${tdClass} text-right font-bold`} style={{
                  color: c.costPerLead === null ? "#475569" : c.costPerLead <= 20 ? "#00E676" : c.costPerLead <= 35 ? "#FFB300" : "#FF3B5C"
                }}>
                  {c.costPerLead !== null ? fmtCurrency(c.costPerLead) : "N/A"}
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#94A3B8" }}>
                  {fmt(c.ctrAll)}%
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#94A3B8" }}>
                  {fmt(c.ctrLink)}%
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#94A3B8" }}>
                  {fmtCurrency(c.cpm)}
                </td>
                <td className={`${tdClass} text-right`} style={{ color: "#94A3B8" }}>
                  {fmt(c.frequency, 2)}×
                </td>
                <td className="px-3 py-3 text-center">
                  <span style={{ color: "#475569" }}>
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
                        background: rowAccent[c.status],
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#475569" }} />
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: "#94A3B8", fontFamily: "'Space Grotesk', sans-serif" }}>
                            Recommendation
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
                            {c.recommendation}
                          </p>
                          <div className="flex gap-4 mt-2 flex-wrap">
                            <span className="text-xs font-mono" style={{ color: "#475569" }}>
                              Reach: <span style={{ color: "#94A3B8" }}>{c.reach.toLocaleString()} Accounts Center accounts</span>
                            </span>
                            <span className="text-xs font-mono" style={{ color: "#475569" }}>
                              Link Clicks: <span style={{ color: "#94A3B8" }}>{c.linkClicks.toLocaleString()}</span>
                            </span>
                            <span className="text-xs font-mono" style={{ color: "#475569" }}>
                              CPC (all): <span style={{ color: "#94A3B8" }}>{fmtCurrency(c.cpcAll)}</span>
                            </span>
                            <span className="text-xs font-mono" style={{ color: "#475569" }}>
                              CPC (link): <span style={{ color: "#94A3B8" }}>{fmtCurrency(c.cpcLink)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
