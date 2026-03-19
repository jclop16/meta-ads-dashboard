// SnapshotHistory — date range performance comparison across all stored snapshots
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Calendar, TrendingUp, DollarSign, Users, Target,
  Eye, MousePointer, ArrowUpRight, ArrowDownRight, Minus,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCplTarget } from "@/contexts/CplTargetContext";
import RefreshButton from "@/components/RefreshButton";

// ── Custom tooltip ────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs font-mono"
      style={{
        background: "#13161E",
        border: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      }}
    >
      <p className="mb-1 font-semibold" style={{ color: "#94A3B8" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#00D4FF" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── Delta badge ───────────────────────────────────────────────
function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value == null || isNaN(value)) return <span style={{ color: "#475569" }}>—</span>;
  const isPositive = inverse ? value < 0 : value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? "#475569" : isPositive ? "#00E676" : "#FF3B5C";
  const Icon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono" style={{ color }}>
      <Icon size={9} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span style={{ color: "#00D4FF" }}>{icon}</span>
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#64748B" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Metric stat card ──────────────────────────────────────────
function StatCard({
  label, value, delta, inverseDelta = false, accent = "neutral",
}: {
  label: string;
  value: string;
  delta?: number | null;
  inverseDelta?: boolean;
  accent?: "cyan" | "win" | "warn" | "poor" | "neutral";
}) {
  const accentColor = {
    cyan: "#00D4FF", win: "#00E676", warn: "#FFB300", poor: "#FF3B5C", neutral: "#94A3B8",
  }[accent];

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "#475569" }}>
        {label}
      </p>
      <p
        className="text-xl font-bold font-mono leading-none mb-1"
        style={{ color: accentColor, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </p>
      {delta != null && <Delta value={delta} inverse={inverseDelta} />}
    </div>
  );
}

// ── Campaign row ──────────────────────────────────────────────
function CampaignRow({ c, cplTarget, getColor }: {
  c: any;
  cplTarget: number;
  getColor: (v: number | null) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const cplColor = getColor(c.costPerLead);

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:brightness-125"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: cplColor }} />
            <span className="text-xs font-mono" style={{ color: "#CBD5E1" }}>{c.shortName}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#94A3B8" }}>
          ${c.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#00E676" }}>
          {c.leads}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs font-bold" style={{ color: cplColor }}>
          {c.costPerLead != null ? `$${c.costPerLead.toFixed(2)}` : "N/A"}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#64748B" }}>
          {c.ctrAll.toFixed(2)}%
        </td>
        <td className="py-3 px-4 text-center">
          {expanded ? <ChevronUp size={12} style={{ color: "#475569" }} /> : <ChevronDown size={12} style={{ color: "#475569" }} />}
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <motion.tr
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <td colSpan={6} className="px-4 pb-3">
              <div
                className="rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono"
                style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)" }}
              >
                <div><span style={{ color: "#475569" }}>Impressions</span><br /><span style={{ color: "#CBD5E1" }}>{c.impressions.toLocaleString()}</span></div>
                <div><span style={{ color: "#475569" }}>Reach</span><br /><span style={{ color: "#CBD5E1" }}>{c.reach.toLocaleString()}</span></div>
                <div><span style={{ color: "#475569" }}>Frequency</span><br /><span style={{ color: "#CBD5E1" }}>{c.frequency.toFixed(2)}×</span></div>
                <div><span style={{ color: "#475569" }}>CPM</span><br /><span style={{ color: "#CBD5E1" }}>${c.cpm.toFixed(2)}</span></div>
                <div><span style={{ color: "#475569" }}>Clicks (all)</span><br /><span style={{ color: "#CBD5E1" }}>{c.clicksAll.toLocaleString()}</span></div>
                <div><span style={{ color: "#475569" }}>Link clicks</span><br /><span style={{ color: "#CBD5E1" }}>{c.linkClicks.toLocaleString()}</span></div>
                <div><span style={{ color: "#475569" }}>CPC (all)</span><br /><span style={{ color: "#CBD5E1" }}>${c.cpcAll.toFixed(4)}</span></div>
                <div><span style={{ color: "#475569" }}>CPC (link)</span><br /><span style={{ color: "#CBD5E1" }}>${c.cpcLink.toFixed(4)}</span></div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function SnapshotHistory() {
  const { cplTarget, getColor } = useCplTarget();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: snapshots = [], isLoading: snapsLoading } = trpc.dashboard.snapshots.useQuery();
  const { data: detail, isLoading: detailLoading } = trpc.dashboard.snapshotDetail.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null }
  );

  // Auto-select the first snapshot when data loads
  const activeId = selectedId ?? (snapshots[0]?.id ?? null);
  const activeSnap = snapshots.find(s => s.id === activeId) ?? null;

  // Comparison: delta vs. last_30d baseline
  const baseline = snapshots.find(s => s.datePreset === "last_30d");
  function pctDelta(current: number, base: number | undefined): number | null {
    if (!base || base === 0) return null;
    return ((current - base) / base) * 100;
  }

  // CPL chart across all snapshots
  const cplChartData = useMemo(
    () =>
      snapshots.map(s => ({
        name: s.datePresetLabel,
        cpl: s.costPerLead,
        color: getColor(s.costPerLead),
      })),
    [snapshots, cplTarget]
  );

  // Spend chart
  const spendChartData = useMemo(
    () =>
      snapshots.map(s => ({
        name: s.datePresetLabel,
        spend: s.amountSpent,
      })),
    [snapshots]
  );

  const hasSnapshots = snapshots.length > 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0D0F14", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(13,15,20,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,212,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:brightness-125"
            style={{
              color: "#64748B",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            ← Dashboard
          </a>
          <div>
            <h1
              className="text-sm font-bold leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E2E8F0" }}
            >
              Performance History
            </h1>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#475569" }}>
              Date range snapshots · Legacy Empowerment Group
            </p>
          </div>
        </div>
        <RefreshButton onRefreshComplete={() => setSelectedId(null)} />
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-[1440px] mx-auto space-y-8">

        {/* ── Empty state ─────────────────────────────────── */}
        {!snapsLoading && !hasSnapshots && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}
            >
              <Calendar size={28} style={{ color: "#00D4FF" }} />
            </div>
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E2E8F0" }}
            >
              No snapshots yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "#475569", maxWidth: 380 }}>
              Click <strong style={{ color: "#00D4FF" }}>Refresh from Meta Ads</strong> to pull live
              performance data for all date ranges and store them here for comparison.
            </p>
            <RefreshButton onRefreshComplete={() => setSelectedId(null)} />
          </motion.div>
        )}

        {/* ── Date range tabs ──────────────────────────────── */}
        {hasSnapshots && (
          <>
            <section>
              <SectionLabel icon={<Calendar size={13} />} label="Date Range Snapshots" />
              <div className="flex flex-wrap gap-2 mt-3">
                {snapshots.map(s => {
                  const isActive = s.id === activeId;
                  return (
                    <motion.button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        background: isActive ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.06)"}`,
                        color: isActive ? "#00D4FF" : "#64748B",
                        boxShadow: isActive ? "0 0 12px rgba(0,212,255,0.1)" : "none",
                      }}
                    >
                      <span>{s.datePresetLabel}</span>
                      {s.isPartial && (
                        <span
                          className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded"
                          style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)" }}
                        >
                          PARTIAL
                        </span>
                      )}
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: "#475569" }}>
                        {s.dateRangeSince} → {s.dateRangeUntil}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* ── Snapshot KPIs ────────────────────────────── */}
            {activeSnap && (
              <motion.section
                key={activeSnap.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <SectionLabel icon={<Target size={13} />} label={`${activeSnap.datePresetLabel} — Account KPIs`} />
                  {activeSnap.isPartial && (
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)", border: "1px solid rgba(255,179,0,0.2)" }}
                    >
                      <Info size={9} /> Partial data — subject to change
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <StatCard
                    label="Amount Spent"
                    value={`$${activeSnap.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.amountSpent, baseline.amountSpent) : undefined}
                    accent="cyan"
                  />
                  <StatCard
                    label="Leads"
                    value={activeSnap.leads.toLocaleString()}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.leads, baseline.leads) : undefined}
                    accent="win"
                  />
                  <StatCard
                    label="Cost per Lead"
                    value={`$${activeSnap.costPerLead.toFixed(2)}`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.costPerLead, baseline.costPerLead) : undefined}
                    inverseDelta
                    accent={activeSnap.costPerLead <= cplTarget ? "win" : activeSnap.costPerLead <= cplTarget * 1.5 ? "warn" : "poor"}
                  />
                  <StatCard
                    label="Impressions"
                    value={`${(activeSnap.impressions / 1000).toFixed(0)}K`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.impressions, baseline.impressions) : undefined}
                    accent="neutral"
                  />
                  <StatCard
                    label="Reach"
                    value={`${(activeSnap.reach / 1000).toFixed(0)}K`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.reach, baseline.reach) : undefined}
                    accent="neutral"
                  />
                  <StatCard
                    label="CTR (all)"
                    value={`${activeSnap.ctrAll.toFixed(2)}%`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.ctrAll, baseline.ctrAll) : undefined}
                    accent="cyan"
                  />
                  <StatCard
                    label="CPM"
                    value={`$${activeSnap.cpm.toFixed(2)}`}
                    delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.cpm, baseline.cpm) : undefined}
                    inverseDelta
                    accent="neutral"
                  />
                </div>
              </motion.section>
            )}

            {/* ── Cross-snapshot comparison charts ─────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div
                className="rounded-lg p-5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <SectionLabel icon={<TrendingUp size={13} />} label="Cost per Lead by Date Range" />
                <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
                  Colors relative to your CPL target (${cplTarget.toFixed(2)})
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cplChartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="cpl" name="Cost per Lead ($)" radius={[3, 3, 0, 0]}>
                      {cplChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                className="rounded-lg p-5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <SectionLabel icon={<DollarSign size={13} />} label="Amount Spent by Date Range" />
                <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
                  Total Amount spent per reporting period
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={spendChartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} formatter={(v: number) => [`$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Amount spent"]} />
                    <Bar dataKey="spend" name="Amount Spent ($)" radius={[3, 3, 0, 0]} fill="#00D4FF" fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Campaign breakdown for selected snapshot ──── */}
            {activeId != null && (
              <section>
                <SectionLabel icon={<Eye size={13} />} label={`Campaign Breakdown — ${activeSnap?.datePresetLabel ?? ""}`} />
                {detailLoading ? (
                  <div className="py-12 text-center text-xs font-mono" style={{ color: "#475569" }}>
                    Loading campaign data…
                  </div>
                ) : detail && detail.campaigns.length > 0 ? (
                  <div
                    className="rounded-lg overflow-hidden mt-3"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {["Campaign", "Amount Spent", "Leads", "Cost per Lead", "CTR (all)", ""].map((h, i) => (
                            <th
                              key={i}
                              className={`py-3 px-4 text-[10px] font-mono uppercase tracking-widest ${i > 0 ? "text-right" : "text-left"} ${i === 5 ? "text-center" : ""}`}
                              style={{ color: "#475569" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.campaigns
                          .sort((a, b) => (a.costPerLead ?? 999) - (b.costPerLead ?? 999))
                          .map(c => (
                            <CampaignRow key={c.id} c={c} cplTarget={cplTarget} getColor={getColor} />
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs font-mono" style={{ color: "#475569" }}>
                    No campaign data available for this snapshot.
                  </div>
                )}
              </section>
            )}

            {/* ── Snapshot metadata ────────────────────────── */}
            <section className="pb-8">
              <SectionLabel icon={<Calendar size={13} />} label="All Snapshots Summary" />
              <div
                className="rounded-lg overflow-hidden mt-3"
                style={{ border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Date Range", "Period", "Amount Spent", "Leads", "Cost per Lead", "CTR (all)", "CPM", "Last Fetched"].map((h, i) => (
                        <th
                          key={i}
                          className={`py-3 px-4 text-[10px] font-mono uppercase tracking-widest ${i > 1 ? "text-right" : "text-left"}`}
                          style={{ color: "#475569" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s, i) => {
                      const cplColor = getColor(s.costPerLead);
                      const isActive = s.id === activeId;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className="cursor-pointer transition-colors hover:brightness-125"
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            background: isActive ? "rgba(0,212,255,0.04)" : "transparent",
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isActive && <div className="w-1 h-4 rounded-full" style={{ background: "#00D4FF" }} />}
                              <span className="text-xs font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: isActive ? "#00D4FF" : "#CBD5E1" }}>
                                {s.datePresetLabel}
                              </span>
                              {s.isPartial && (
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)" }}>
                                  PARTIAL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono" style={{ color: "#64748B" }}>
                            {s.dateRangeSince} → {s.dateRangeUntil}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#94A3B8" }}>
                            ${s.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#00E676" }}>
                            {s.leads}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-bold" style={{ color: cplColor }}>
                            ${s.costPerLead.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#64748B" }}>
                            {s.ctrAll.toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#64748B" }}>
                            ${s.cpm.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[10px]" style={{ color: "#475569" }}>
                            {new Date(s.fetchedAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
