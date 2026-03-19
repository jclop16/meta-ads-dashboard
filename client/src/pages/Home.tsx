// ============================================================
// META ADS DASHBOARD — Home Page
// Design: Dark Data Terminal / Bloomberg-Inspired Command Center
// - Deep charcoal (#0D0F14) base with electric cyan (#00D4FF) accents
// - JetBrains Mono for all numbers, Space Grotesk for headings
// - Color-coded performance: green=win, amber=moderate, red=loss
// - Bento-grid layout with glowing card borders
// ============================================================

import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  DollarSign, Users, MousePointer, TrendingUp, Eye, Target,
  AlertTriangle, CheckCircle, Clock, Zap, BarChart2, RefreshCw,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import ActionPanel from "@/components/ActionPanel";
import CampaignTable from "@/components/CampaignTable";
import {
  accountMetrics, campaigns, actionItems, spendByObjective,
  leadsByCampaign, REPORT_DATE_RANGE, ACCOUNT_NAME,
} from "@/lib/data";

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
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("$")
            ? `$${p.value.toFixed(2)}`
            : p.value}
        </p>
      ))}
    </div>
  );
}

// ── CPL vs Spend scatter-style bar chart data ───────────────
const cplSpendData = campaigns
  .filter(c => c.costPerLead !== null)
  .sort((a, b) => (a.costPerLead ?? 0) - (b.costPerLead ?? 0))
  .map(c => ({
    name: c.shortName.replace("DS | ", "").replace(" | Leads | CBO | FB", ""),
    cpl: c.costPerLead,
    spent: c.amountSpent,
    status: c.status,
  }));

const cplColors = cplSpendData.map(d =>
  d.status === "excellent" ? "#00E676" : d.status === "moderate" ? "#FFB300" : "#FF3B5C"
);

// ── Spend by objective donut ────────────────────────────────
const DONUT_COLORS = ["#00D4FF", "#00E676", "#FF3B5C"];

// ── Simulated daily spend trend (30 days) ──────────────────
const dailyTrend = Array.from({ length: 30 }, (_, i) => {
  const base = 480 + Math.sin(i / 3) * 60 + Math.random() * 40;
  const leads = Math.round(20 + Math.sin(i / 4) * 8 + Math.random() * 6);
  return {
    day: `Feb ${17 + i > 28 ? `Mar ${17 + i - 28}` : 17 + i}`,
    spent: parseFloat(base.toFixed(2)),
    leads,
  };
});

export default function Home() {
  const totalLeads = accountMetrics.leads;
  const totalSpend = accountMetrics.amountSpent;
  const avgCPL = accountMetrics.costPerLead;

  const excellentCount = campaigns.filter(c => c.status === "excellent").length;
  const poorCount = campaigns.filter(c => c.status === "poor").length;
  const wastedSpend = campaigns
    .filter(c => c.status === "poor")
    .reduce((s, c) => s + c.amountSpent, 0);

  return (
    <div
      className="min-h-screen grid-bg"
      style={{ background: "#0D0F14", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{
          background: "rgba(13,15,20,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,212,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
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
              {ACCOUNT_NAME}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.15)",
              color: "#00D4FF",
            }}
          >
            <Clock size={11} />
            {REPORT_DATE_RANGE}
          </div>
          <div
            className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full"
            style={{
              background: "rgba(255,179,0,0.1)",
              border: "1px solid rgba(255,179,0,0.2)",
              color: "#FFB300",
            }}
          >
            <AlertTriangle size={10} />
            Partial data
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ────────────────────────────────────── */}
      <div
        className="relative px-6 py-10 overflow-hidden"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663448934432/QTGwE5aAupQz3MyiEqLWFv/dashboard-hero-bg-9vtDn5uishwb9ntHnoxkZC.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        {/* Dark overlay */}
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
              Performance Review · Last 30 Days
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
              {excellentCount} campaigns performing excellently · {poorCount} campaigns wasting budget
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main className="px-4 sm:px-6 py-6 space-y-8 max-w-[1440px] mx-auto">

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
              label="Cost per Lead"
              value={`$${avgCPL.toFixed(2)}`}
              subValue="Account average"
              icon={<TrendingUp size={14} />}
              accent="win"
              delay={0.1}
            />
            <MetricCard
              label="Impressions"
              value={`${(accountMetrics.impressions / 1000).toFixed(0)}K`}
              subValue={accountMetrics.impressions.toLocaleString()}
              icon={<Eye size={14} />}
              accent="neutral"
              delay={0.15}
            />
            <MetricCard
              label="Reach"
              value={`${(accountMetrics.reach / 1000).toFixed(0)}K`}
              subValue="Accounts Center accounts"
              icon={<Users size={14} />}
              accent="neutral"
              delay={0.2}
            />
            <MetricCard
              label="CTR (all)"
              value={`${accountMetrics.ctrAll}%`}
              subValue={`Link CTR: ${accountMetrics.ctrLink}%`}
              icon={<MousePointer size={14} />}
              accent="cyan"
              delay={0.25}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <MetricCard
              label="CPM"
              value={`$${accountMetrics.cpm.toFixed(2)}`}
              subValue="Cost per 1,000 impressions"
              accent="neutral"
              delay={0.3}
            />
            <MetricCard
              label="CPC (all)"
              value={`$${accountMetrics.cpcAll.toFixed(4)}`}
              subValue="Cost per click (all)"
              accent="neutral"
              delay={0.35}
            />
            <MetricCard
              label="CPC (link)"
              value={`$${accountMetrics.cpcLink.toFixed(4)}`}
              subValue="Cost per link click"
              accent="neutral"
              delay={0.4}
            />
            <MetricCard
              label="Frequency"
              value={`${accountMetrics.frequency}×`}
              subValue="Avg impressions per account"
              accent="warn"
              delay={0.45}
            />
          </div>
        </section>

        {/* ── CHARTS ROW ───────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* CPL by Campaign */}
          <div className="lg:col-span-2 glow-card rounded-lg p-5">
            <SectionLabel icon={<TrendingUp size={13} />} label="Cost per Lead by Campaign" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Sorted by CPL ascending · Green ≤$20 · Amber $20–$35 · Red &gt;$35
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cplSpendData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
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
                  width={160}
                  tick={{ fill: "#64748B", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="cpl" name="Cost per Lead ($)" radius={[0, 3, 3, 0]}>
                  {cplSpendData.map((_, i) => (
                    <Cell key={i} fill={cplColors[i]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spend by Objective Donut */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<DollarSign size={13} />} label="Spend by Objective" />
            <p className="text-xs mt-1 mb-2" style={{ color: "#475569" }}>
              Total: $14,647.37
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={spendByObjective}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {spendByObjective.map((entry, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} fillOpacity={0.9} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Spent"]}
                  contentStyle={{
                    background: "#13161E",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {spendByObjective.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                    <span style={{ color: "#94A3B8" }}>{d.name}</span>
                  </div>
                  <span style={{ color: "#E2E8F0" }}>
                    ${d.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LEADS BAR CHART ──────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<Target size={13} />} label="Lead Volume by Campaign" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Campaigns with at least 1 lead conversion
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsByCampaign} margin={{ left: 0, right: 16, top: 4, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="leads" name="Leads" radius={[3, 3, 0, 0]}>
                  {leadsByCampaign.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.status === "excellent" ? "#00E676" : d.status === "moderate" ? "#00D4FF" : "#FF3B5C"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Spend Trend */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<RefreshCw size={13} />} label="Daily Spend & Lead Trend" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Simulated 30-day trend based on account totals
            </p>
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
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  interval={4}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spent"
                  name="Amount Spent ($)"
                  stroke="#00D4FF"
                  strokeWidth={1.5}
                  fill="url(#spendGrad)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="#00E676"
                  strokeWidth={1.5}
                  fill="url(#leadsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── CAMPAIGN TABLE ───────────────────────────────── */}
        <section>
          <SectionLabel icon={<BarChart2 size={13} />} label="Campaign Breakdown" />
          <p className="text-xs mt-1 mb-3" style={{ color: "#475569" }}>
            Click any row to expand recommendations · Sort by any column header
          </p>
          <CampaignTable campaigns={campaigns} />
        </section>

        {/* ── WINNERS & WASTERS ────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Winners */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<CheckCircle size={13} />} label="What's Working" color="#00E676" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Campaigns with CPL ≤ $20 — below account average of $22.43
            </p>
            <div className="space-y-3">
              {campaigns
                .filter(c => c.status === "excellent")
                .sort((a, b) => (a.costPerLead ?? 999) - (b.costPerLead ?? 999))
                .map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-md p-3"
                    style={{
                      background: "rgba(0,230,118,0.05)",
                      border: "1px solid rgba(0,230,118,0.15)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className="text-sm font-semibold mb-1"
                          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1" }}
                        >
                          {c.shortName}
                        </p>
                        <div className="flex gap-3 flex-wrap">
                          <Stat label="CPL" value={`$${c.costPerLead?.toFixed(2)}`} color="#00E676" />
                          <Stat label="Leads" value={String(c.leads)} color="#00E676" />
                          <Stat label="Spent" value={`$${c.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} color="#94A3B8" />
                          <Stat label="CTR (all)" value={`${c.ctrAll}%`} color="#94A3B8" />
                        </div>
                      </div>
                      <StatusBadge status="excellent" size="sm" />
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>

          {/* Wasters */}
          <div className="glow-card rounded-lg p-5">
            <SectionLabel icon={<AlertTriangle size={13} />} label="What's Wasting Budget" color="#FF3B5C" />
            <p className="text-xs mt-1 mb-4" style={{ color: "#475569" }}>
              Campaigns with CPL &gt; $35 — 3× above account average ·{" "}
              <span style={{ color: "#FF3B5C" }}>
                ${wastedSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })} at risk
              </span>
            </p>
            <div className="space-y-3">
              {campaigns
                .filter(c => c.status === "poor")
                .sort((a, b) => b.amountSpent - a.amountSpent)
                .map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-md p-3"
                    style={{
                      background: "rgba(255,59,92,0.06)",
                      border: "1px solid rgba(255,59,92,0.2)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className="text-sm font-semibold mb-1"
                          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1" }}
                        >
                          {c.shortName}
                        </p>
                        <div className="flex gap-3 flex-wrap">
                          <Stat label="CPL" value={`$${c.costPerLead?.toFixed(2)}`} color="#FF3B5C" />
                          <Stat label="Leads" value={String(c.leads)} color="#FF3B5C" />
                          <Stat label="Spent" value={`$${c.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} color="#94A3B8" />
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
              Data source: Meta Ads API · Account: Legacy Empowerment Group (act_77497873)
            </p>
            <p className="text-xs font-mono" style={{ color: "#334155" }}>
              ⚠ Partial data — {REPORT_DATE_RANGE} includes today and is subject to change
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
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
