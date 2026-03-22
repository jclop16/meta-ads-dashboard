// SnapshotHistory — date range performance comparison across all stored snapshots
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Calendar, TrendingUp, DollarSign, Target,
  Eye, ArrowUpRight, ArrowDownRight, Minus,
  ChevronDown, ChevronUp, Info, Search, X,
  ChevronsUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCplTarget } from "@/contexts/CplTargetContext";
import RefreshButton from "@/components/RefreshButton";
import ThemeToggle from "@/components/ThemeToggle";

// ── Types ─────────────────────────────────────────────────────
type SortKey = "shortName" | "amountSpent" | "leads" | "costPerLead" | "ctrAll";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "excellent" | "moderate" | "poor";

// ── Custom tooltip ────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs font-mono"
      style={{
        background: "var(--dash-panel-solid)",
        border: "1px solid color-mix(in srgb, var(--color-cyan) 22%, var(--dash-border))",
        boxShadow: "var(--dash-shadow)",
      }}
    >
      <p className="mb-1 font-semibold" style={{ color: "var(--dash-text-soft)" }}>{label}</p>
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
  if (value == null || isNaN(value)) return <span style={{ color: "var(--dash-subtle)" }}>—</span>;
  const isPositive = inverse ? value < 0 : value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? "var(--dash-subtle)" : isPositive ? "#00E676" : "#FF3B5C";
  const Icon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono" style={{ color }}>
      <Icon size={9} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span style={{ color: "#00D4FF" }}>{icon}</span>
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-muted)" }}
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
        background: "var(--dash-panel)",
        border: "1px solid var(--dash-border)",
      }}
    >
      <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--dash-subtle)" }}>
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

// ── Sort icon ─────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={10} style={{ color: "var(--dash-subtle)" }} />;
  return sortDir === "asc"
    ? <ArrowUp size={10} style={{ color: "#00D4FF" }} />
    : <ArrowDown size={10} style={{ color: "#00D4FF" }} />;
}

// ── Sortable column header ────────────────────────────────────
function SortTh({
  col, label, sortKey, sortDir, onSort, align = "right",
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = col === sortKey;
  return (
    <th
      className={`py-3 px-4 text-[10px] font-mono uppercase tracking-widest cursor-pointer select-none group ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: isActive ? "#00D4FF" : "var(--dash-subtle)" }}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

// ── Filter chip ───────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full"
      style={{
        background: "color-mix(in srgb, var(--color-cyan) 10%, var(--dash-panel-soft))",
        border: "1px solid color-mix(in srgb, var(--color-cyan) 28%, var(--dash-border))",
        color: "var(--color-cyan)",
      }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={9} />
      </button>
    </span>
  );
}

// ── Campaign row ──────────────────────────────────────────────
function CampaignRow({ c, getColor }: {
  c: any;
  getColor: (v: number | null) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const cplColor = getColor(c.costPerLead);

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:brightness-125"
        style={{ borderBottom: "1px solid var(--dash-border)" }}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: cplColor }} />
            <div>
              <span className="text-xs font-mono block" style={{ color: "var(--dash-text)" }}>{c.shortName}</span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded mt-0.5 inline-block"
                style={{
                  background: "var(--dash-panel-soft)",
                  color: "var(--dash-muted)",
                }}
              >
                {c.objective}
              </span>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "var(--dash-text-soft)" }}>
          ${c.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#00E676" }}>
          {c.leads}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs font-bold" style={{ color: cplColor }}>
          {c.costPerLead != null ? `$${c.costPerLead.toFixed(2)}` : "N/A"}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "var(--dash-muted)" }}>
          {c.ctrAll.toFixed(2)}%
        </td>
        <td className="py-3 px-4 text-center">
          {expanded ? <ChevronUp size={12} style={{ color: "var(--dash-subtle)" }} /> : <ChevronDown size={12} style={{ color: "var(--dash-subtle)" }} />}
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
                style={{
                  background: "color-mix(in srgb, var(--color-cyan) 4%, var(--dash-panel-soft))",
                  border: "1px solid color-mix(in srgb, var(--color-cyan) 18%, var(--dash-border))",
                }}
              >
                <div><span style={{ color: "var(--dash-subtle)" }}>Impressions</span><br /><span style={{ color: "var(--dash-text)" }}>{c.impressions.toLocaleString()}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>Reach</span><br /><span style={{ color: "var(--dash-text)" }}>{c.reach.toLocaleString()}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>Frequency</span><br /><span style={{ color: "var(--dash-text)" }}>{c.frequency.toFixed(2)}×</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>CPM</span><br /><span style={{ color: "var(--dash-text)" }}>${c.cpm.toFixed(2)}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>Clicks (all)</span><br /><span style={{ color: "var(--dash-text)" }}>{c.clicksAll.toLocaleString()}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>Link clicks</span><br /><span style={{ color: "var(--dash-text)" }}>{c.linkClicks.toLocaleString()}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>CPC (all)</span><br /><span style={{ color: "var(--dash-text)" }}>${c.cpcAll.toFixed(4)}</span></div>
                <div><span style={{ color: "var(--dash-subtle)" }}>CPC (link)</span><br /><span style={{ color: "var(--dash-text)" }}>${c.cpcLink.toFixed(4)}</span></div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Status label map ──────────────────────────────────────────
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  excellent: "On Target",
  moderate: "Moderate",
  poor: "Over Target",
};

const STATUS_COLORS: Record<StatusFilter, string> = {
  all: "#64748B",
  excellent: "#00E676",
  moderate: "#FFB300",
  poor: "#FF3B5C",
};

// ── Main page ─────────────────────────────────────────────────
export default function SnapshotHistory() {
  const { cplTarget, getColor, getStatus } = useCplTarget();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ── Filter state ──────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");

  // ── Sort state ────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("costPerLead");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir(col === "shortName" ? "asc" : "asc");
    }
  };

  const { data: snapshots = [], isLoading: snapsLoading } = trpc.dashboard.snapshots.useQuery();
  const { data: detail, isLoading: detailLoading } = trpc.dashboard.snapshotDetail.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null }
  );

  useEffect(() => {
    if (selectedId == null && snapshots[0]?.id != null) {
      setSelectedId(snapshots[0].id);
    }
  }, [selectedId, snapshots]);

  const activeId = selectedId ?? (snapshots[0]?.id ?? null);
  const activeSnap = snapshots.find(s => s.id === activeId) ?? null;

  const baseline = snapshots.find(s => s.datePreset === "last_30d");
  function pctDelta(current: number, base: number | undefined): number | null {
    if (!base || base === 0) return null;
    return ((current - base) / base) * 100;
  }

  // ── Derived objective list ────────────────────────────────
  const objectives = useMemo(() => {
    if (!detail?.campaigns) return [];
    const set = new Set(detail.campaigns.map((c: any) => c.objective as string));
    return Array.from(set).sort();
  }, [detail?.campaigns]);

  // ── Filtered + sorted campaigns ───────────────────────────
  const filteredCampaigns = useMemo(() => {
    if (!detail?.campaigns) return [];
    let list = [...detail.campaigns] as any[];

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.shortName.toLowerCase().includes(q) || c.campaignName.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(c => getStatus(c.costPerLead) === statusFilter);
    }

    // Objective filter
    if (objectiveFilter !== "all") {
      list = list.filter(c => c.objective === objectiveFilter);
    }

    // Sort
    list.sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      if (sortKey === "costPerLead") {
        aVal = aVal ?? 9999;
        bVal = bVal ?? 9999;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [detail?.campaigns, search, statusFilter, objectiveFilter, sortKey, sortDir, cplTarget]);

  // ── Active filter chips ───────────────────────────────────
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (search.trim()) activeFilters.push({ label: `"${search.trim()}"`, clear: () => setSearch("") });
  if (statusFilter !== "all") activeFilters.push({ label: STATUS_LABELS[statusFilter], clear: () => setStatusFilter("all") });
  if (objectiveFilter !== "all") activeFilters.push({ label: objectiveFilter, clear: () => setObjectiveFilter("all") });

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setObjectiveFilter("all");
  };

  // ── Chart data ────────────────────────────────────────────
  const cplChartData = useMemo(
    () => snapshots.map(s => ({ name: s.datePresetLabel, cpl: s.costPerLead, color: getColor(s.costPerLead) })),
    [snapshots, cplTarget]
  );
  const spendChartData = useMemo(
    () => snapshots.map(s => ({ name: s.datePresetLabel, spend: s.amountSpent })),
    [snapshots]
  );

  const hasSnapshots = snapshots.length > 0;

  return (
    <div
      className="dashboard-page min-h-screen overflow-x-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--dash-header)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--dash-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:brightness-125"
            style={{
              color: "var(--dash-text-soft)",
              background: "var(--dash-panel-soft)",
              border: "1px solid var(--dash-border)",
            }}
          >
            ← Dashboard
          </a>
          <div>
            <h1
              className="text-sm font-bold leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
            >
              Performance History
            </h1>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--dash-subtle)" }}>
              Date range snapshots · Legacy Empowerment Group
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton onRefreshComplete={() => setSelectedId(null)} />
        </div>
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
              style={{
                background: "color-mix(in srgb, var(--color-cyan) 10%, var(--dash-panel-soft))",
                border: "1px solid color-mix(in srgb, var(--color-cyan) 26%, var(--dash-border))",
              }}
            >
              <Calendar size={28} style={{ color: "#00D4FF" }} />
            </div>
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
            >
              No snapshots yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--dash-muted)", maxWidth: 380 }}>
              Click <strong style={{ color: "#00D4FF" }}>Refresh from Meta Ads</strong> to pull live
              performance data for all date ranges and store them here for comparison.
            </p>
            <RefreshButton onRefreshComplete={() => setSelectedId(null)} />
          </motion.div>
        )}

        {hasSnapshots && (
          <>
            {/* ── Date range tabs ──────────────────────────── */}
            <section>
              <SectionLabel icon={<Calendar size={13} />} label="Date Range Snapshots" />
              <div className="flex flex-wrap gap-2 mt-3">
                {snapshots.map(s => {
                  const isActive = s.id === activeId;
                  return (
                    <motion.button
                      key={s.id}
                      onClick={() => {
                        setSelectedId(s.id);
                        clearAllFilters();
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                        className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                        style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        background: isActive
                          ? "color-mix(in srgb, var(--color-cyan) 12%, var(--dash-panel-soft))"
                          : "var(--dash-panel-soft)",
                        border: `1px solid ${isActive
                          ? "color-mix(in srgb, var(--color-cyan) 38%, var(--dash-border))"
                          : "var(--dash-border)"}`,
                        color: isActive ? "#00D4FF" : "var(--dash-text-soft)",
                        boxShadow: isActive ? "0 0 12px rgba(0,212,255,0.1)" : "none",
                      }}
                    >
                      <span>{s.datePresetLabel}</span>
                      {s.isPartial && (
                        <span className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)" }}>
                          PARTIAL
                        </span>
                      )}
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--dash-subtle)" }}>
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1" style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)", border: "1px solid rgba(255,179,0,0.2)" }}>
                      <Info size={9} /> Partial data — subject to change
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <StatCard label="Amount Spent" value={`$${activeSnap.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.amountSpent, baseline.amountSpent) : undefined} accent="cyan" />
                  <StatCard label="Leads" value={activeSnap.leads.toLocaleString()} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.leads, baseline.leads) : undefined} accent="win" />
                  <StatCard label="Cost per Lead" value={`$${activeSnap.costPerLead.toFixed(2)}`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.costPerLead, baseline.costPerLead) : undefined} inverseDelta accent={activeSnap.costPerLead <= cplTarget ? "win" : activeSnap.costPerLead <= cplTarget * 1.5 ? "warn" : "poor"} />
                  <StatCard label="Impressions" value={`${(activeSnap.impressions / 1000).toFixed(0)}K`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.impressions, baseline.impressions) : undefined} accent="neutral" />
                  <StatCard label="Reach" value={`${(activeSnap.reach / 1000).toFixed(0)}K`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.reach, baseline.reach) : undefined} accent="neutral" />
                  <StatCard label="CTR (all)" value={`${activeSnap.ctrAll.toFixed(2)}%`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.ctrAll, baseline.ctrAll) : undefined} accent="cyan" />
                  <StatCard label="CPM" value={`$${activeSnap.cpm.toFixed(2)}`} delta={baseline && activeSnap.id !== baseline.id ? pctDelta(activeSnap.cpm, baseline.cpm) : undefined} inverseDelta accent="neutral" />
                </div>
              </motion.section>
            )}

            {/* ── Comparison charts ────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg p-5" style={{ background: "var(--dash-panel)", border: "1px solid var(--dash-border)" }}>
                <SectionLabel icon={<TrendingUp size={13} />} label="Cost per Lead by Date Range" />
                <p className="text-xs mt-1 mb-4" style={{ color: "var(--dash-subtle)" }}>Colors relative to your CPL target (${cplTarget.toFixed(2)})</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cplChartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--dash-subtle)", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--dash-subtle)", fontSize: 9, fontFamily: "JetBrains Mono" }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="cpl" name="Cost per Lead ($)" radius={[3, 3, 0, 0]}>
                      {cplChartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg p-5" style={{ background: "var(--dash-panel)", border: "1px solid var(--dash-border)" }}>
                <SectionLabel icon={<DollarSign size={13} />} label="Amount Spent by Date Range" />
                <p className="text-xs mt-1 mb-4" style={{ color: "var(--dash-subtle)" }}>Total amount spent per reporting period</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={spendChartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--dash-subtle)", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--dash-subtle)", fontSize: 9, fontFamily: "JetBrains Mono" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} formatter={(v: number) => [`$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Amount spent"]} />
                    <Bar dataKey="spend" name="Amount Spent ($)" radius={[3, 3, 0, 0]} fill="#00D4FF" fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Campaign breakdown ───────────────────────── */}
            {activeId != null && (
              <section>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <SectionLabel icon={<Eye size={13} />} label={`Campaign Breakdown — ${activeSnap?.datePresetLabel ?? ""}`} />
                  {detail && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--dash-subtle)" }}>
                      {filteredCampaigns.length} of {detail.campaigns.length} campaigns
                    </span>
                  )}
                </div>

                {/* ── Filter + sort controls ──────────────── */}
                {detail && detail.campaigns.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {/* Row 1: search + status + objective */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Search */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[180px] max-w-xs"
                        style={{ background: "var(--dash-panel-soft)", border: "1px solid var(--dash-border)" }}
                      >
                        <Search size={12} style={{ color: "var(--dash-subtle)", flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder="Search campaigns…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full bg-transparent text-xs font-mono outline-none"
                          style={{ color: "var(--dash-text)" }}
                        />
                        {search && (
                          <button onClick={() => setSearch("")} className="hover:opacity-70">
                            <X size={10} style={{ color: "var(--dash-subtle)" }} />
                          </button>
                        )}
                      </div>

                      {/* Status filter */}
                      <div className="flex items-center gap-1">
                        {(["all", "excellent", "moderate", "poor"] as StatusFilter[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg transition-all"
                            style={{
                              background: statusFilter === s
                                ? s === "all" ? "var(--dash-panel-soft)" : `${STATUS_COLORS[s]}18`
                                : "var(--dash-panel-soft)",
                              border: `1px solid ${statusFilter === s
                                ? s === "all" ? "var(--dash-border-strong)" : `${STATUS_COLORS[s]}50`
                                : "var(--dash-border)"}`,
                              color: statusFilter === s ? STATUS_COLORS[s] : "var(--dash-subtle)",
                            }}
                          >
                            {s === "all" ? "All" : s === "excellent" ? "On Target" : s === "moderate" ? "Moderate" : "Over Target"}
                          </button>
                        ))}
                      </div>

                      {/* Objective filter */}
                      {objectives.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setObjectiveFilter("all")}
                            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg transition-all"
                            style={{
                              background: objectiveFilter === "all" ? "var(--dash-panel-soft)" : "var(--dash-panel-soft)",
                              border: `1px solid ${objectiveFilter === "all" ? "var(--dash-border-strong)" : "var(--dash-border)"}`,
                              color: objectiveFilter === "all" ? "var(--dash-text-soft)" : "var(--dash-subtle)",
                            }}
                          >
                            All Objectives
                          </button>
                          {objectives.map((obj: string) => (
                            <button
                              key={obj}
                              onClick={() => setObjectiveFilter(obj)}
                              className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg transition-all"
                              style={{
                                background: objectiveFilter === obj
                                  ? "color-mix(in srgb, var(--color-cyan) 10%, var(--dash-panel-soft))"
                                  : "var(--dash-panel-soft)",
                                border: `1px solid ${objectiveFilter === obj
                                  ? "color-mix(in srgb, var(--color-cyan) 30%, var(--dash-border))"
                                  : "var(--dash-border)"}`,
                                color: objectiveFilter === obj ? "#00D4FF" : "var(--dash-subtle)",
                              }}
                            >
                              {obj}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Clear all */}
                      {activeFilters.length > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="text-[10px] font-mono px-2 py-1.5 rounded-lg transition-all hover:opacity-70"
                          style={{ color: "#FF3B5C", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)" }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Row 2: active filter chips */}
                    {activeFilters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-mono" style={{ color: "var(--dash-subtle)" }}>Active filters:</span>
                        {activeFilters.map((f, i) => (
                          <FilterChip key={i} label={f.label} onRemove={f.clear} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Table ──────────────────────────────────── */}
                {detailLoading ? (
                  <div className="py-12 text-center text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                    Loading campaign data…
                  </div>
                ) : filteredCampaigns.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--dash-border)" }}>
                    <table className="w-full min-w-[780px]">
                      <thead>
                        <tr style={{ background: "var(--dash-panel-soft)", borderBottom: "1px solid var(--dash-border)" }}>
                          <SortTh col="shortName" label="Campaign" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left" />
                          <SortTh col="amountSpent" label="Amount Spent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <SortTh col="leads" label="Leads" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <SortTh col="costPerLead" label="Cost per Lead" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <SortTh col="ctrAll" label="CTR (all)" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <th className="py-3 px-4 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCampaigns.map(c => (
                          <CampaignRow key={c.id} c={c} getColor={getColor} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : detail && detail.campaigns.length > 0 ? (
                  // No results after filtering
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-16 text-center rounded-lg"
                    style={{ border: "1px solid var(--dash-border)", background: "var(--dash-panel)" }}
                  >
                    <Search size={24} className="mx-auto mb-3" style={{ color: "var(--dash-subtle)" }} />
                    <p className="text-sm font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text-soft)" }}>
                      No campaigns match your filters
                    </p>
                    <p className="text-xs font-mono mb-4" style={{ color: "var(--dash-subtle)" }}>
                      Try adjusting the status, objective, or search term
                    </p>
                    <button
                      onClick={clearAllFilters}
                      className="text-xs font-mono px-4 py-2 rounded-lg transition-all hover:brightness-125"
                      style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
                    >
                      Clear all filters
                    </button>
                  </motion.div>
                ) : (
                  <div className="py-8 text-center text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
                    No campaign data available for this snapshot.
                  </div>
                )}
              </section>
            )}

            {/* ── Snapshot summary table ───────────────────── */}
            <section className="pb-8">
              <SectionLabel icon={<Calendar size={13} />} label="All Snapshots Summary" />
              <div className="mt-3 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--dash-border)" }}>
                <table className="w-full min-w-[920px]">
                  <thead>
                    <tr style={{ background: "var(--dash-panel-soft)", borderBottom: "1px solid var(--dash-border)" }}>
                      {["Date Range", "Period", "Amount Spent", "Leads", "Cost per Lead", "CTR (all)", "CPM", "Last Fetched"].map((h, i) => (
                        <th key={i} className={`py-3 px-4 text-[10px] font-mono uppercase tracking-widest ${i > 1 ? "text-right" : "text-left"}`} style={{ color: "var(--dash-subtle)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map(s => {
                      const cplColor = getColor(s.costPerLead);
                      const isActive = s.id === activeId;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => { setSelectedId(s.id); clearAllFilters(); }}
                          className="cursor-pointer transition-colors hover:brightness-125"
                          style={{
                            borderBottom: "1px solid var(--dash-border)",
                            background: isActive
                              ? "color-mix(in srgb, var(--color-cyan) 4%, var(--dash-panel-soft))"
                              : "transparent",
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isActive && <div className="w-1 h-4 rounded-full" style={{ background: "#00D4FF" }} />}
                              <span className="text-xs font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: isActive ? "#00D4FF" : "var(--dash-text)" }}>
                                {s.datePresetLabel}
                              </span>
                              {s.isPartial && (
                                <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ color: "#FFB300", background: "rgba(255,179,0,0.1)" }}>PARTIAL</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>{s.dateRangeSince} → {s.dateRangeUntil}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "var(--dash-text-soft)" }}>${s.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "#00E676" }}>{s.leads}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-bold" style={{ color: cplColor }}>${s.costPerLead.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "var(--dash-muted)" }}>{s.ctrAll.toFixed(2)}%</td>
                          <td className="py-3 px-4 text-right font-mono text-xs" style={{ color: "var(--dash-muted)" }}>${s.cpm.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-[10px]" style={{ color: "var(--dash-subtle)" }}>{new Date(s.fetchedAt).toLocaleString()}</td>
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
