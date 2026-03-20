// ============================================================
// META ADS DASHBOARD — Home Page
// Design: Dark Data Terminal / Bloomberg-Inspired Command Center
// - Deep charcoal (#0D0F14) base with electric cyan (#00D4FF) accents
// - JetBrains Mono for all numbers, Space Grotesk for headings
// - Color-coded performance: green=win, amber=moderate, red=loss
// - All CPL highlights are DYNAMIC via CplTargetContext
// ============================================================

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  DollarSign, Users, MousePointer, TrendingUp, Eye, Target,
  AlertTriangle, CheckCircle, Clock, Zap, BarChart2, RefreshCw,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import ActionPanel from "@/components/ActionPanel";
import CampaignTable from "@/components/CampaignTable";
import CplTargetInput from "@/components/CplTargetInput";
import RefreshButton from "@/components/RefreshButton";
import { useCplTarget } from "@/contexts/CplTargetContext";
import type { DailyPerformancePoint } from "@/lib/dashboardTypes";

const DONUT_COLORS = ["#00D4FF", "#00E676", "#FF3B5C"];

// ── Custom Tooltip ──────────────────────────────────────────
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
          {p.name}: {typeof p.value === "number" && String(p.name).toLowerCase().includes("$")
            ? `$${p.value.toFixed(2)}`
            : p.value}
        </p>
      ))}
    </div>
  );
}

function summarizeDays(days: DailyPerformancePoint[]) {
  const totals = days.reduce(
    (acc, day) => {
      acc.amountSpent += day.amountSpent;
      acc.leads += day.leads;
      return acc;
    },
    { amountSpent: 0, leads: 0 }
  );

  return {
    ...totals,
    costPerLead:
      totals.leads > 0 ? Number((totals.amountSpent / totals.leads).toFixed(2)) : null,
  };
}

function formatDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? "Flat vs prior 7d" : "No prior 7d baseline";
  }

  const delta = ((current - previous) / previous) * 100;
  const direction = delta > 0 ? "+" : "";
  return `${direction}${delta.toFixed(1)}% vs prior 7d`;
}

function formatRefreshTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return "No successful refresh yet";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// ── Inner dashboard — has access to CplTargetContext ────────
function DashboardContent() {
  const { cplTarget, getStatus, getColor } = useCplTarget();

  // Load data from database via tRPC
  const { data: metaState } = trpc.dashboard.metaState.useQuery();
  const { data: refreshStatusData } = trpc.dashboard.refreshStatus.useQuery(
    undefined,
    {
      refetchInterval: 60 * 1000,
    }
  );
  const { data: metricsData } = trpc.dashboard.accountMetrics.useQuery();
  const { data: campaignsData } = trpc.dashboard.campaigns.useQuery();
  const { data: actionItemsData } = trpc.dashboard.actionItems.useQuery();
  const { data: dailyPerformanceData } = trpc.dashboard.dailyPerformance.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fall back to zeros while loading
  const totalLeads = metricsData?.leads ?? 0;
  const totalSpend = metricsData?.amountSpent ?? 0;
  const avgCPL = metricsData?.costPerLead ?? 0;
  const campaigns = campaignsData ?? [];
  const actionItems = actionItemsData ?? [];
  const accountName = metricsData?.accountName ?? "Meta Ad Account";
  const reportDateRange = metricsData?.reportDateRange ?? "No reporting window yet";
  const dataSourceLabel =
    metaState?.sourceMode === "live" ? "Live Meta Graph API" : "Demo Mode";
  const latestRefreshStatus = refreshStatusData?.latestStatus ?? null;
  const lastSuccessfulRefreshLabel = formatRefreshTimestamp(
    refreshStatusData?.lastSuccessfulRefreshAt
  );
  const latestRefreshFinishedLabel = formatRefreshTimestamp(
    refreshStatusData?.latestFinishedAt
  );
  const dailyTrend = useMemo(
    () =>
      (dailyPerformanceData?.days ?? []).map(day => ({
        day: day.label,
        spent: day.amountSpent,
        leads: day.leads,
      })),
    [dailyPerformanceData]
  );

  // Compute spend by objective from live campaign data
  const spendByObjective = useMemo(() => {
    const map: Record<
      string,
      { name: string; value: number; leads: number; campaigns: number }
    > = {};
    for (const c of campaigns) {
      if (!map[c.objective]) {
        map[c.objective] = {
          name: c.objective,
          value: 0,
          leads: 0,
          campaigns: 0,
        };
      }
      map[c.objective].value += c.amountSpent;
      map[c.objective].leads += c.leads;
      map[c.objective].campaigns += 1;
    }
    return Object.values(map)
      .map(objective => ({
        ...objective,
        costPerLead:
          objective.leads > 0
            ? Number((objective.value / objective.leads).toFixed(2))
            : null,
      }))
      .sort((left, right) => right.value - left.value);
  }, [campaigns]);

  // Dynamic counts based on current target
  const excellentCampaigns = useMemo(
    () => campaigns.filter(c => getStatus(c.costPerLead) === "excellent"),
    [campaigns, cplTarget]
  );
  const poorCampaigns = useMemo(
    () => campaigns.filter(c => getStatus(c.costPerLead) === "poor"),
    [campaigns, cplTarget]
  );
  const wastedSpend = useMemo(
    () => poorCampaigns.reduce((s, c) => s + c.amountSpent, 0),
    [poorCampaigns]
  );

  // CPL bar chart data — colors driven by target
  const cplChartData = useMemo(
    () =>
      campaigns
        .filter(c => c.costPerLead !== null)
        .sort((a, b) => (a.costPerLead ?? 0) - (b.costPerLead ?? 0))
        .map(c => ({
          name: c.shortName,
          cpl: c.costPerLead,
          color: getColor(c.costPerLead),
        })),
    [campaigns, cplTarget]
  );

  // Lead volume chart — colors driven by target
  const leadsChartData = useMemo(
    () =>
      campaigns
        .filter(c => c.leads > 0)
        .sort((a, b) => b.leads - a.leads)
        .map(c => ({
          name: c.shortName,
          leads: c.leads,
          color: getColor(c.costPerLead),
        })),
    [campaigns, cplTarget]
  );

  const trailingSevenDaySummary = useMemo(
    () => summarizeDays((dailyPerformanceData?.days ?? []).slice(-7)),
    [dailyPerformanceData]
  );
  const priorSevenDaySummary = useMemo(
    () => summarizeDays((dailyPerformanceData?.days ?? []).slice(-14, -7)),
    [dailyPerformanceData]
  );

  return (
    <div
      className="min-h-screen grid-bg"
      style={{ background: "#0D0F14", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(13,15,20,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,212,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3 flex-shrink-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663448934432/QTGwE5aAupQz3MyiEqLWFv/meta-logo-icon-eYSYyQuej67BqrVa9EmrMH.webp"
            alt="Logo"
            className="w-7 h-7 object-contain"
          />
          <div>
            <h1
              className="text-sm font-bold leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E2E8F0" }}
            >
              Meta Ads Dashboard
            </h1>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#475569" }}>
              {accountName}
            </p>
          </div>
        </div>

        {/* CPL Target Input — center of header */}
        <div className="flex-1 flex justify-center">
          <CplTargetInput />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.15)",
              color: "#00D4FF",
            }}
          >
            <Clock size={11} />
            {reportDateRange}
          </div>
          <a
            href="/history"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:brightness-125"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94A3B8",
            }}
          >
            <BarChart2 size={12} />
            History
          </a>
          <RefreshButton />
        </div>
      </header>

      <div
        className="px-4 sm:px-6 py-2 border-b"
        style={{
          borderColor: "rgba(255,255,255,0.05)",
          background:
            metaState?.sourceMode === "live"
              ? "rgba(0,212,255,0.04)"
              : "rgba(255,179,0,0.08)",
        }}
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span
            className="px-2 py-1 rounded-full"
            style={{
              color: metaState?.sourceMode === "live" ? "#00D4FF" : "#FFB300",
              background:
                metaState?.sourceMode === "live"
                  ? "rgba(0,212,255,0.1)"
                  : "rgba(255,179,0,0.12)",
            }}
          >
            {dataSourceLabel}
          </span>
          <span style={{ color: "#64748B" }}>
            {metaState?.sourceMode === "live"
              ? `Connected to ${metaState.adAccountId ?? "your configured ad account"}`
              : "Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to switch from demo data to live Meta reporting."}
          </span>
          <span style={{ color: "#475569" }}>
            Last success: {lastSuccessfulRefreshLabel}
          </span>
          <span
            className="px-2 py-1 rounded-full"
            style={{
              color:
                latestRefreshStatus === "failed"
                  ? "#FF3B5C"
                  : latestRefreshStatus === "success"
                    ? "#00E676"
                    : "#FFB300",
              background:
                latestRefreshStatus === "failed"
                  ? "rgba(255,59,92,0.12)"
                  : latestRefreshStatus === "success"
                    ? "rgba(0,230,118,0.12)"
                    : "rgba(255,179,0,0.12)",
            }}
          >
            Latest run: {latestRefreshStatus ?? "none"}
          </span>
          {refreshStatusData?.latestFinishedAt ? (
            <span style={{ color: "#475569" }}>
              Finished: {latestRefreshFinishedLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── HERO BANNER ────────────────────────────────────── */}
      <div
        className="relative px-6 py-10 overflow-hidden"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663448934432/QTGwE5aAupQz3MyiEqLWFv/dashboard-hero-bg-9vtDn5uishwb9ntHnoxkZC.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(13,15,20,0.7) 0%, rgba(13,15,20,0.9) 60%)" }}
        />
        <div className="relative z-10 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#00D4FF" }}>
              Performance Review · {reportDateRange}
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold leading-tight mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#F1F5F9" }}
            >
              Your ads spent{" "}
              <span style={{ color: "#00D4FF" }}>
                ${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <br />
              and generated{" "}
              <span style={{ color: "#00E676" }}>{totalLeads} leads</span>
            </h2>
            <p className="text-sm" style={{ color: "#64748B" }}>
              vs. your CPL target of{" "}
              <span style={{ color: "#00D4FF" }} className="font-mono font-semibold">
                ${cplTarget.toFixed(2)}
              </span>
              {" "}·{" "}
              <span style={{ color: "#00E676" }}>{excellentCampaigns.length} on target</span>
              {" "}·{" "}
              <span style={{ color: "#FF3B5C" }}>{poorCampaigns.length} over target</span>
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main className="px-4 sm:px-6 py-6 space-y-8 max-w-[1440px] mx-auto">
        {latestRefreshStatus === "failed" ? (
          <section
            className="rounded-lg border px-4 py-3 flex flex-wrap items-start gap-3"
            style={{
              background: "rgba(255,59,92,0.08)",
              borderColor: "rgba(255,59,92,0.22)",
            }}
          >
            <AlertTriangle size={16} style={{ color: "#FF3B5C", marginTop: 2 }} />
            <div className="space-y-1">
              <p
                className="text-sm font-semibold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#FCA5A5" }}
              >
                Latest refresh failed
              </p>
              <p className="text-xs font-mono" style={{ color: "#CBD5E1" }}>
                {refreshStatusData?.latestErrorMessage ?? "Unknown refresh failure"}
              </p>
              {refreshStatusData?.latestFailedPresets?.length ? (
                <p className="text-[11px] font-mono" style={{ color: "#94A3B8" }}>
                  Failed presets: {refreshStatusData.latestFailedPresets.join(" · ")}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── KPI GRID ─────────────────────────────────────── */}
        <section>
          <SectionLabel icon={<BarChart2 size={13} />} label="Account KPIs" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
            <MetricCard
              label="Amount Spent"
              value={`$${(totalSpend / 1000).toFixed(1)}K`}
              subValue={`$${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              icon={<DollarSign size={14} />}
              accent="cyan"
              delay={0}
            />
            <MetricCard
              label="Leads"
              value={totalLeads.toLocaleString()}
              subValue="Total conversions"
              icon={<Target size={14} />}
              accent="win"
              delay={0.05}
            />
            <MetricCard
              label="Avg CPL"
              value={`$${avgCPL.toFixed(2)}`}
              subValue={`Target: $${cplTarget.toFixed(2)}`}
              icon={<TrendingUp size={14} />}
              accent={avgCPL <= cplTarget ? "win" : "warn"}
              delay={0.1}
            />
            <MetricCard
              label="Impressions"
              value={`${((metricsData?.impressions ?? 0) / 1000).toFixed(0)}K`}
              subValue={(metricsData?.impressions ?? 0).toLocaleString()}
              icon={<Eye size={14} />}
              accent="neutral"
              delay={0.15}
            />
            <MetricCard
              label="Reach"
              value={`${((metricsData?.reach ?? 0) / 1000).toFixed(0)}K`}
              subValue="Accounts Center accounts"
              icon={<Users size={14} />}
              accent="neutral"
              delay={0.2}
            />
            <MetricCard
              label="CTR (all)"
              value={`${metricsData?.ctrAll ?? 0}%`}
              subValue={`Link CTR: ${metricsData?.ctrLink ?? 0}%`}
              icon={<MousePointer size={14} />}
              accent="cyan"
              delay={0.25}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <MetricCard label="CPM" value={`$${(metricsData?.cpm ?? 0).toFixed(2)}`} subValue="Cost per 1,000 impressions" accent="neutral" delay={0.3} />
            <MetricCard label="CPC (all)" value={`$${(metricsData?.cpcAll ?? 0).toFixed(4)}`} subValue="Cost per click (all)" accent="neutral" delay={0.35} />
            <MetricCard label="CPC (link)" value={`$${(metricsData?.cpcLink ?? 0).toFixed(4)}`} subValue="Cost per link click" accent="neutral" delay={0.4} />
            <MetricCard label="Frequency" value={`${metricsData?.frequency ?? 0}×`} subValue="Avg impressions per account" accent="warn" delay={0.45} />
          </div>
        </section>

        {/* ── CHARTS ROW ───────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* CPL by Campaign — dynamic colors */}
          <div className="lg:col-span-2 glow-card rounded-lg p-5">
            <SectionLabel icon={<TrendingUp size={13} />} label="Cost per Lead by Campaign" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Sorted by CPL ascending · Colors update with your CPL target · Dashed line = your target ($
              {cplTarget.toFixed(2)})
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cplChartData} layout="vertical" margin={{ left: 8, right: 50, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickFormatter={v => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={170}
                  tick={{ fill: "#64748B", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine
                  x={cplTarget}
                  stroke="#00D4FF"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Target $${cplTarget.toFixed(0)}`,
                    position: "right",
                    fill: "#00D4FF",
                    fontSize: 9,
                    fontFamily: "JetBrains Mono",
                  }}
                />
                <Bar dataKey="cpl" name="Cost per Lead ($)" radius={[0, 3, 3, 0]}>
                  {cplChartData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spend by Objective Donut */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<DollarSign size={13} />} label="Spend by Objective" />
            <p className="text-xs mt-1 mb-2" style={{ color: "#475569" }}>
              Total: ${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={spendByObjective} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {spendByObjective.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} fillOpacity={0.9} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Spent"]}
                  contentStyle={{ background: "#13161E", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px", fontSize: "11px", fontFamily: "JetBrains Mono" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {spendByObjective.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <div className="flex flex-col">
                      <span style={{ color: "#94A3B8" }}>{d.name}</span>
                      <span style={{ color: "#475569", fontSize: "10px" }}>
                        {d.leads} leads · {d.campaigns} campaign{d.campaigns !== 1 ? "s" : ""}
                        {d.costPerLead != null ? ` · $${d.costPerLead.toFixed(2)} CPL` : ""}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: "#E2E8F0" }}>
                    ${d.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LEADS + TREND ────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<Target size={13} />} label="Lead Volume by Campaign" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Bar color reflects CPL performance vs. your target
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsChartData} margin={{ left: 0, right: 16, top: 4, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="leads" name="Leads" radius={[3, 3, 0, 0]}>
                  {leadsChartData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<RefreshCw size={13} />} label="Daily Spend & Lead Trend" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Persisted 30-day account series from the latest refresh
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <PulseCard
                label="Last 7d Spend"
                value={`$${trailingSevenDaySummary.amountSpent.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                subValue={formatDelta(
                  trailingSevenDaySummary.amountSpent,
                  priorSevenDaySummary.amountSpent
                )}
                color="#00D4FF"
              />
              <PulseCard
                label="Last 7d Leads"
                value={trailingSevenDaySummary.leads.toLocaleString()}
                subValue={formatDelta(
                  trailingSevenDaySummary.leads,
                  priorSevenDaySummary.leads
                )}
                color="#00E676"
              />
              <PulseCard
                label="Last 7d CPL"
                value={
                  trailingSevenDaySummary.costPerLead != null
                    ? `$${trailingSevenDaySummary.costPerLead.toFixed(2)}`
                    : "No leads"
                }
                subValue={`Target: $${cplTarget.toFixed(2)}`}
                color={
                  trailingSevenDaySummary.costPerLead != null
                    ? getColor(trailingSevenDaySummary.costPerLead)
                    : "#94A3B8"
                }
              />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyTrend} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }} interval={4} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="spent" name="Amount Spent ($)" stroke="#00D4FF" strokeWidth={1.5} fill="url(#spendGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#00E676" strokeWidth={1.5} fill="url(#leadsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── CAMPAIGN TABLE ───────────────────────────────── */}
        <section>
          <SectionLabel icon={<BarChart2 size={13} />} label="Campaign Breakdown" />
          <p className="text-xs mt-1 mb-3" style={{ color: "#475569" }}>
            All highlights update live with your CPL target · Click any row to expand · Sort by any column
          </p>
          <CampaignTable campaigns={campaigns} />
        </section>

        {/* ── WINNERS & WASTERS (dynamic) ──────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Winners */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<CheckCircle size={13} />} label="On Target" color="#00E676" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Campaigns with CPL ≤ your target of{" "}
              <span className="font-mono" style={{ color: "#00D4FF" }}>${cplTarget.toFixed(2)}</span>
            </p>
            {excellentCampaigns.length === 0 ? (
              <p className="text-xs font-mono" style={{ color: "#475569" }}>
                No campaigns meet this target. Try raising your CPL goal.
              </p>
            ) : (
              <div className="space-y-3">
                {excellentCampaigns
                  .sort((a, b) => (a.costPerLead ?? 999) - (b.costPerLead ?? 999))
                  .map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="rounded-md p-3"
                      style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.15)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1" }}>
                            {c.shortName}
                          </p>
                          <div className="flex gap-3 flex-wrap">
                            <Stat label="CPL" value={`$${c.costPerLead?.toFixed(2)}`} color="#00E676" />
                            <Stat label="vs Target" value={`-$${(cplTarget - (c.costPerLead ?? 0)).toFixed(2)}`} color="#00E676" />
                            <Stat label="Leads" value={String(c.leads)} color="#94A3B8" />
                            <Stat label="Spent" value={`$${c.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} color="#94A3B8" />
                          </div>
                        </div>
                        <StatusBadge status="excellent" size="sm" />
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </div>

          {/* Over Target */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<AlertTriangle size={13} />} label="Over Target" color="#FF3B5C" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Campaigns with CPL &gt; 1.5× your target ·{" "}
              <span style={{ color: "#FF3B5C" }}>
                ${wastedSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })} at risk
              </span>
            </p>
            {poorCampaigns.length === 0 ? (
              <p className="text-xs font-mono" style={{ color: "#475569" }}>
                All campaigns are within 1.5× of your target. 
              </p>
            ) : (
              <div className="space-y-3">
                {poorCampaigns
                  .sort((a, b) => b.amountSpent - a.amountSpent)
                  .map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="rounded-md p-3"
                      style={{ background: "rgba(255,59,92,0.06)", border: "1px solid rgba(255,59,92,0.2)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1" }}>
                            {c.shortName}
                          </p>
                          <div className="flex gap-3 flex-wrap">
                            <Stat label="CPL" value={`$${c.costPerLead?.toFixed(2)}`} color="#FF3B5C" />
                            <Stat label="vs Target" value={`+$${((c.costPerLead ?? 0) - cplTarget).toFixed(2)}`} color="#FF3B5C" />
                            <Stat label="Leads" value={String(c.leads)} color="#94A3B8" />
                            <Stat label="CPM" value={`$${c.cpm.toFixed(2)}`} color="#FF3B5C" />
                          </div>
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: "#64748B" }}>
                            {c.recommendation}
                          </p>
                        </div>
                        <StatusBadge status="poor" size="sm" />
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* ── ACTION ITEMS ─────────────────────────────────── */}
        <section>
          <SectionLabel icon={<Zap size={13} />} label="Actionable Next Steps" />
          <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
            Prioritized recommendations based on performance data and Meta's optimization mechanics
          </p>
          <ActionPanel items={actionItems} />
        </section>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer className="py-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-xs font-mono" style={{ color: "#334155" }}>
              Data source: {dataSourceLabel}
              {metaState?.adAccountId ? ` · Account: ${metaState.adAccountId}` : ""}
            </p>
            <p className="text-xs font-mono" style={{ color: "#334155" }}>
              Reporting window: {reportDateRange}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function Home() {
  return <DashboardContent />;
}

// ── Helper Components ───────────────────────────────────────
function SectionLabel({
  icon,
  label,
  color = "#00D4FF",
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <h3
        className="text-xs font-bold uppercase tracking-widest"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#64748B" }}
      >
        {label}
      </h3>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#334155" }}>
        {label}
      </span>
      <span className="text-xs font-mono font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function PulseCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue: string;
  color: string;
}) {
  return (
    <div
      className="rounded-md p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#475569" }}>
        {label}
      </div>
      <div className="text-base font-semibold mt-1" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </div>
      <div className="text-[10px] font-mono mt-1" style={{ color: "#64748B" }}>
        {subValue}
      </div>
    </div>
  );
}
