import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, ChevronDown, ChevronRight, Download, Filter, Layers3, Search, Sparkles, Target, Waypoints } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCplTarget } from "@/contexts/CplTargetContext";
import StatusBadge from "@/components/StatusBadge";
import ThemeToggle from "@/components/ThemeToggle";

const PRESET_OPTIONS = [
  { value: "last_30d", label: "Last 30 Days" },
  { value: "last_7d", label: "Last 7 Days" },
  { value: "last_90d", label: "Last 90 Days" },
  { value: "this_week_mon_today", label: "This Week" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "custom", label: "Custom Range" },
] as const;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetDates(preset: (typeof PRESET_OPTIONS)[number]["value"]) {
  const today = new Date();
  const end = new Date(today);

  switch (preset) {
    case "today":
      return { since: toIsoDate(end), until: toIsoDate(end) };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { since: toIsoDate(yesterday), until: toIsoDate(yesterday) };
    }
    case "last_7d": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { since: toIsoDate(start), until: toIsoDate(end) };
    }
    case "last_90d": {
      const start = new Date(today);
      start.setDate(today.getDate() - 89);
      return { since: toIsoDate(start), until: toIsoDate(end) };
    }
    case "this_week_mon_today": {
      const start = new Date(today);
      const day = start.getDay();
      const offset = day === 0 ? 6 : day - 1;
      start.setDate(today.getDate() - offset);
      return { since: toIsoDate(start), until: toIsoDate(end) };
    }
    case "custom":
    case "last_30d":
    default: {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { since: toIsoDate(start), until: toIsoDate(end) };
    }
  }
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const csv = [
    headers.join(","),
    ...rows.map(row =>
      row
        .map(value => {
          const text = value == null ? "" : String(value);
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ExplorerTooltip({ active, payload, label }: any) {
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
      <p className="mb-1" style={{ color: "var(--dash-text-soft)" }}>
        {label}
      </p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {typeof entry.value === "number" && entry.name !== "Leads"
            ? `$${entry.value.toFixed(2)}`
            : entry.value}
        </p>
      ))}
    </div>
  );
}

function formatDelta(value: number | null, inverse = false) {
  if (value == null) return "No prior-period baseline";

  const signed = inverse ? value * -1 : value;
  const prefix = signed > 0 ? "+" : "";
  return `${prefix}${signed.toFixed(1)}% vs prior period`;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseDisplaySegments(rawName: string) {
  const segments = rawName
    .split("|")
    .map(segment => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    editorCode: segments[0] ?? null,
    campaignDescriptor: segments[1] ?? null,
  };
}

function getPreferredCampaignLabel(input: {
  rawName: string;
  displayName: string;
  editorCode: string | null;
  campaignDescriptor: string | null;
}) {
  const parsed = parseDisplaySegments(input.rawName);
  const editorCode = input.editorCode ?? parsed.editorCode;
  const campaignDescriptor = input.campaignDescriptor ?? parsed.campaignDescriptor;

  if (editorCode && campaignDescriptor) {
    return `${editorCode} | ${campaignDescriptor}`;
  }

  return input.displayName || input.rawName;
}

function FilterPill({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs font-mono"
      style={{
        background: "var(--dash-panel-soft)",
        border: "1px solid var(--dash-border)",
        color: "var(--dash-text-soft)",
      }}
    >
      <span style={{ color: "var(--dash-subtle)" }}>{label}: </span>
      <span style={{ color: "var(--dash-text)" }}>{value ?? "—"}</span>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="min-w-0 rounded-2xl p-5"
      style={{
        background: "var(--dash-panel)",
        border: "1px solid var(--dash-border)",
        boxShadow: "var(--dash-shadow)",
      }}
    >
      <div className="mb-4">
        <h2
          className="text-sm font-semibold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MiniTag({ label }: { label: string }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[10px] font-mono"
      style={{
        background: "var(--dash-panel-soft)",
        border: "1px solid var(--dash-border)",
        color: "var(--dash-text-soft)",
      }}
    >
      {label}
    </span>
  );
}

type InsightEntity = {
  name: string;
  displayName?: string;
  performanceStatus: "excellent" | "moderate" | "poor";
  performanceScore: number;
  recommendation: string;
  amountSpent: number;
  leads: number;
  costPerLead: number | null;
  costPerLeadDeltaPct: number | null;
  ctrLinkDeltaPct: number | null;
  editorCode?: string | null;
  launchLabel?: string | null;
  audienceDescriptor?: string | null;
};

function getInsightTone(status: InsightEntity["performanceStatus"]) {
  if (status === "excellent") {
    return {
      accent: "#00E676",
      label: "Scale Signal",
      impact: "Protect what is working while testing careful scale.",
      risk: "Monitor quality drift if you add budget too fast.",
    };
  }

  if (status === "poor") {
    return {
      accent: "#FF3B5C",
      label: "Efficiency Risk",
      impact: "Reduce wasted spend and stabilize the current acquisition cost.",
      risk: "Quick cost cuts can also reduce lead volume if the traffic is still learning.",
    };
  }

  return {
    accent: "#FFB300",
    label: "Optimization Watch",
    impact: "Tighten the campaign before trying to scale.",
    risk: "Low-volume changes can look better before they are statistically stable.",
  };
}

function buildActionItems(entity: InsightEntity) {
  const items: string[] = [];

  if (entity.costPerLead != null) {
    if (entity.performanceStatus === "poor") {
      items.push("Tighten budget, audience, or creative before adding more spend to this scope.");
    } else if (entity.performanceStatus === "excellent") {
      items.push("Protect the current setup and test careful scale in controlled budget increments.");
    } else {
      items.push("Refine the weakest lever first before trying to scale the current delivery.");
    }
  } else {
    items.push("This scope has spend without enough conversion signal yet. Stabilize the offer or traffic before scaling.");
  }

  if (entity.leads < 5) {
    items.push("Lead volume is still light. Treat efficiency changes as directional until more conversions land.");
  } else if ((entity.costPerLeadDeltaPct ?? 0) > 15) {
    items.push("CPL is worsening versus the prior period. Review recent edits, audience saturation, and landing-page changes.");
  } else {
    items.push("Current lead volume is strong enough to compare against the prior period with more confidence.");
  }

  if ((entity.ctrLinkDeltaPct ?? 0) < -10) {
    items.push("Link CTR is deteriorating. Refresh hooks, headlines, or creative angles before blaming the funnel.");
  } else if ((entity.ctrLinkDeltaPct ?? 0) > 10) {
    items.push("CTR is improving. Preserve the winning message while watching downstream efficiency and lead quality.");
  } else {
    items.push("CTR is relatively stable. Focus the next adjustment on conversion efficiency, not clickthrough alone.");
  }

  return items.slice(0, 3);
}

function RecommendationCallout({
  entity,
  title,
}: {
  entity: InsightEntity;
  title: string;
}) {
  const tone = getInsightTone(entity.performanceStatus);
  const actions = buildActionItems(entity);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "color-mix(in srgb, var(--dash-panel) 85%, transparent)",
        border: `1px solid color-mix(in srgb, ${tone.accent} 32%, var(--dash-border))`,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{ background: `${tone.accent}18`, color: tone.accent }}
        >
          <Sparkles size={11} />
          {tone.label}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--dash-subtle)" }}>
          Score {entity.performanceScore}/100
        </span>
      </div>

      <h3
        className="mt-3 text-sm font-semibold"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--dash-text-soft)" }}>
        {entity.recommendation}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div
          className="rounded-lg px-3 py-3 text-xs font-mono"
          style={{ background: "var(--dash-panel-soft)", border: "1px solid var(--dash-border)" }}
        >
          <div style={{ color: "var(--dash-subtle)" }}>Expected effect</div>
          <div className="mt-1" style={{ color: "var(--dash-text)" }}>
            {tone.impact}
          </div>
        </div>
        <div
          className="rounded-lg px-3 py-3 text-xs font-mono"
          style={{ background: "var(--dash-panel-soft)", border: "1px solid var(--dash-border)" }}
        >
          <div style={{ color: "var(--dash-subtle)" }}>Watch out</div>
          <div className="mt-1" style={{ color: "var(--dash-text)" }}>
            {entity.leads < 5
              ? "Lead volume is still light. Treat directional improvements cautiously until more conversions land."
              : tone.risk}
          </div>
        </div>
      </div>

      <div
        className="mt-3 rounded-lg px-3 py-3"
        style={{ background: "var(--dash-panel-soft)", border: "1px solid var(--dash-border)" }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "var(--dash-subtle)" }}
        >
          Actionable next steps
        </div>
        <div className="mt-2 space-y-2">
          {actions.map(item => (
            <div key={item} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: "var(--dash-text-soft)" }}>
              <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: tone.accent }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <FilterPill label="Spend" value={formatCurrency(entity.amountSpent)} />
        <FilterPill label="Leads" value={entity.leads.toLocaleString()} />
        <FilterPill
          label="CPL"
          value={entity.costPerLead != null ? formatCurrency(entity.costPerLead) : "No leads"}
        />
        <FilterPill label="CPL Δ" value={formatDelta(entity.costPerLeadDeltaPct, true)} />
        <FilterPill label="CTR Δ" value={formatDelta(entity.ctrLinkDeltaPct)} />
      </div>
    </div>
  );
}

function BreakdownMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--dash-subtle)" }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-mono font-semibold" style={{ color: "var(--dash-text)" }}>
        {value}
      </div>
    </div>
  );
}

export default function Explorer() {
  const { cplTarget } = useCplTarget();
  const [preset, setPreset] =
    useState<(typeof PRESET_OPTIONS)[number]["value"]>("last_30d");
  const [since, setSince] = useState(() => getPresetDates("last_30d").since);
  const [until, setUntil] = useState(() => getPresetDates("last_30d").until);
  const [objective, setObjective] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      preset,
      since: since || null,
      until: until || null,
      objective: objective === "all" ? null : objective,
      status: status === "all" ? null : status,
      query: query.trim() || null,
    }),
    [objective, preset, query, since, status, until]
  );

  useEffect(() => {
    if (preset === "custom") {
      return;
    }

    const next = getPresetDates(preset);
    setSince(next.since);
    setUntil(next.until);
  }, [preset]);

  const { data: summaryData, isLoading: isSummaryLoading } =
    trpc.dashboard.explorerSummary.useQuery(filters);
  const { data: campaignRows = [], isLoading: isCampaignsLoading } =
    trpc.dashboard.explorerCampaigns.useQuery(filters);
  const { data: adsetRows = [], isLoading: isAdsetsLoading } =
    trpc.dashboard.explorerAdsets.useQuery(
      {
        ...filters,
        campaignId: selectedCampaignId ?? "",
      },
      {
        enabled: Boolean(selectedCampaignId),
      }
    );
  const { data: adRows = [], isLoading: isAdsLoading } =
    trpc.dashboard.explorerAds.useQuery(
      {
        ...filters,
        adsetId: selectedAdsetId ?? "",
      },
      {
        enabled: Boolean(selectedAdsetId),
      }
    );

  const trendLevel = selectedAdsetId
    ? "adset"
    : selectedCampaignId
      ? "campaign"
      : "account";
  const trendEntityId = selectedAdsetId ?? selectedCampaignId ?? null;
  const { data: trendRows = [], isLoading: isTrendLoading } =
    trpc.dashboard.explorerTrend.useQuery({
      ...filters,
      level: trendLevel,
      entityId: trendEntityId,
    });

  useEffect(() => {
    if (!campaignRows.length) {
      setSelectedCampaignId(null);
      setSelectedAdsetId(null);
      return;
    }

    if (selectedCampaignId && !campaignRows.some(row => row.id === selectedCampaignId)) {
      setSelectedCampaignId(null);
      setSelectedAdsetId(null);
    }
  }, [campaignRows, selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId || !adsetRows.length) {
      setSelectedAdsetId(null);
      return;
    }

    if (selectedAdsetId && !adsetRows.some(row => row.id === selectedAdsetId)) {
      setSelectedAdsetId(null);
    }
  }, [adsetRows, selectedAdsetId, selectedCampaignId]);

  const selectedCampaign = campaignRows.find(row => row.id === selectedCampaignId) ?? null;
  const selectedAdset = adsetRows.find(row => row.id === selectedAdsetId) ?? null;
  const availableRangeLabel =
    summaryData?.availableDataSince && summaryData?.availableDataUntil
      ? `${summaryData.availableDataSince} to ${summaryData.availableDataUntil}`
      : "Awaiting first historical sync";
  const overallFocus = useMemo(() => {
    const poorPerformer = campaignRows
      .filter(row => row.performanceStatus === "poor")
      .sort((left, right) => right.amountSpent - left.amountSpent)[0];

    if (poorPerformer) {
      return poorPerformer;
    }

    return [...campaignRows].sort((left, right) => right.performanceScore - left.performanceScore)[0] ?? null;
  }, [campaignRows]);
  const interpretationEntity = selectedAdset ?? selectedCampaign ?? overallFocus;
  const interpretationTitle = selectedAdset
    ? `Recommended next move for ${selectedAdset.name}`
    : selectedCampaign
      ? `Recommended next move for ${selectedCampaign.displayName}`
      : overallFocus
        ? `Recommended focus inside ${summaryData?.range.label ?? "the filtered window"}`
        : "Recommended focus";

  return (
    <div
      className="dashboard-page min-h-screen overflow-x-hidden"
    >
      <header
        className="sticky top-0 z-40 border-b px-4 py-4"
        style={{
          background: "var(--dash-header)",
          borderColor: "var(--dash-border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.22em]" style={{ color: "#00D4FF" }}>
              Reporting Workspace
            </p>
            <h1
              className="mt-1 text-2xl font-bold"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}
            >
              Meta Explorer
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--dash-muted)" }}>
              Drill from campaign to ad set to ad before introducing Meta write actions.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <ThemeToggle />
            <a
              href="/"
              className="rounded-lg px-3 py-2 transition-colors hover:brightness-125"
              style={{
                background: "var(--dash-panel-soft)",
                border: "1px solid var(--dash-border)",
                color: "var(--dash-text)",
              }}
            >
              Executive Summary
            </a>
            <a
              href="/history"
              className="rounded-lg px-3 py-2 transition-colors hover:brightness-125"
              style={{
                background: "var(--dash-panel-soft)",
                border: "1px solid var(--dash-border)",
                color: "var(--dash-text)",
              }}
            >
              Snapshot History
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6">
        <SectionCard
          title="Filters"
          subtitle="Preset buttons prefill the range, but explicit dates drive the reporting queries."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span className="inline-flex items-center gap-1"><Filter size={12} /> Date Shortcut</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
                value={preset}
                onChange={event =>
                  setPreset(event.target.value as (typeof PRESET_OPTIONS)[number]["value"])
                }
              >
                {PRESET_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span className="inline-flex items-center gap-1"><CalendarRange size={12} /> Start Date</span>
              <input
                type="date"
                value={since}
                min={summaryData?.availableDataSince ?? undefined}
                max={until || (summaryData?.availableDataUntil ?? undefined)}
                onChange={event => {
                  setPreset("custom");
                  setSince(event.target.value);
                }}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
              />
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span>End Date</span>
              <input
                type="date"
                value={until}
                min={since || (summaryData?.availableDataSince ?? undefined)}
                max={summaryData?.availableDataUntil ?? undefined}
                onChange={event => {
                  setPreset("custom");
                  setUntil(event.target.value);
                }}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
              />
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span>Objective</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
                value={objective}
                onChange={event => setObjective(event.target.value)}
              >
                <option value="all">All Objectives</option>
                {(summaryData?.availableObjectives ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span>Status</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="all">All Statuses</option>
                {(summaryData?.availableStatuses ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              <span className="inline-flex items-center gap-1"><Search size={12} /> Name Search</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Campaign, ad set, or ad"
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "var(--dash-panel-soft)",
                  border: "1px solid var(--dash-border)",
                  color: "var(--dash-text)",
                }}
              />
            </label>

          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterPill label="Available Data" value={availableRangeLabel} />
            <FilterPill label="Current Shortcut" value={PRESET_OPTIONS.find(option => option.value === preset)?.label ?? preset} />
          </div>
        </SectionCard>

        <SectionCard
          title="Comparison Overview"
          subtitle={summaryData?.range.label ?? "Loading current period…"}
        >
          <div className="grid gap-3 lg:grid-cols-4">
            <FilterPill
              label="Spend"
              value={
                isSummaryLoading
                  ? "Loading…"
                  : `${formatCurrency(summaryData?.current.amountSpent ?? 0)} · ${formatDelta(summaryData?.deltas.amountSpent ?? null)}`
              }
            />
            <FilterPill
              label="Leads"
              value={
                isSummaryLoading
                  ? "Loading…"
                  : `${summaryData?.current.leads ?? 0} · ${formatDelta(summaryData?.deltas.leads ?? null)}`
              }
            />
            <FilterPill
              label="Blended CPL"
              value={
                isSummaryLoading
                  ? "Loading…"
                  : `${formatCurrency(summaryData?.current.costPerLead ?? 0)} · ${formatDelta(summaryData?.deltas.costPerLead ?? null, true)}`
              }
            />
            <FilterPill
              label="Link CTR"
              value={
                isSummaryLoading
                  ? "Loading…"
                  : `${(summaryData?.current.ctrLink ?? 0).toFixed(2)}% · ${formatDelta(summaryData?.deltas.ctrLink ?? null)}`
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterPill label="Campaigns" value={summaryData?.counts.campaigns ?? 0} />
            <FilterPill label="Ad Sets" value={summaryData?.counts.adsets ?? 0} />
            <FilterPill label="Ads" value={summaryData?.counts.ads ?? 0} />
            <FilterPill label="Stored Range" value={availableRangeLabel} />
            <FilterPill
              label="Updated"
              value={
                summaryData?.lastUpdatedAt
                  ? new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(summaryData.lastUpdatedAt))
                  : "No refresh yet"
              }
            />
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard
            title="Trend"
            subtitle={
              selectedAdset
                ? `${selectedCampaign?.displayName ?? selectedAdset.campaignDisplayName} / ${selectedAdset.name}`
                : selectedCampaign
                  ? `${selectedCampaign.displayName} · campaign scope`
                  : "Filtered account scope"
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterPill label="Scope" value={trendLevel} />
              <FilterPill label="CPL Target" value={formatCurrency(cplTarget)} />
              <FilterPill
                label="Breadcrumb"
                value={
                  selectedAdset
                    ? `${selectedCampaign?.displayName ?? "Campaign"} / ${selectedAdset.name}`
                    : selectedCampaign?.displayName ?? "Account"
                }
              />
            </div>

            <div style={{ height: 280 }}>
              {isTrendLoading ? (
                <div className="flex h-full items-center justify-center text-sm font-mono" style={{ color: "#64748B" }}>
                  Loading trend…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendRows}>
                    <defs>
                      <linearGradient id="trendSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#00D4FF" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="trendLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00E676" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-chart-grid)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--dash-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "var(--dash-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={value => `$${value}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "var(--dash-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ExplorerTooltip />} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="amountSpent"
                      name="Spend"
                      stroke="#00D4FF"
                      fill="url(#trendSpend)"
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#00E676"
                      fill="url(#trendLeads)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Interpretation Panel"
            subtitle="Filters drive the overall readout. Selections only take over when you intentionally drill into a campaign or ad set."
          >
            <div className="grid gap-3">
              <FilterPill label="Selected Campaign" value={selectedCampaign?.displayName ?? "None"} />
              <FilterPill label="Selected Ad Set" value={selectedAdset?.name ?? "None"} />
              <FilterPill
                label="Current Focus"
                value={
                  selectedAdset
                    ? "Ad set drilldown"
                    : selectedCampaign
                      ? "Campaign drilldown"
                      : "Filtered account scope"
                }
              />
              <FilterPill label="Editor" value={selectedCampaign?.editorCode ?? selectedAdset?.editorCode ?? "—"} />
              <FilterPill label="Launch" value={selectedCampaign?.launchLabel ?? selectedAdset?.launchLabel ?? "—"} />
              <FilterPill label="Audience" value={selectedCampaign?.audienceDescriptor ?? selectedAdset?.audienceDescriptor ?? "—"} />
            </div>
            {interpretationEntity ? (
              <div className="mt-4">
                <RecommendationCallout entity={interpretationEntity} title={interpretationTitle} />
              </div>
            ) : null}
          </SectionCard>
        </div>

        <SectionCard
          title="Campaign Drilldown"
          subtitle="Click a campaign to reveal its ad sets inline. Click an ad set to reveal its ads inside the same reading flow."
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
              Filters control the overview and default trend. Drilldowns only take over when you expand them.
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  "campaign-breakdown.csv",
                  [
                    "Campaign",
                    "Editor",
                    "Launch",
                    "Audience",
                    "Objective",
                    "Spend",
                    "Spend Delta %",
                    "Leads",
                    "Leads Delta %",
                    "CPL",
                    "CPL Delta %",
                    "CTR Link",
                    "CTR Delta %",
                    "Performance Score",
                    "Status",
                  ],
                  campaignRows.map(row => [
                    row.displayName,
                    row.editorCode,
                    row.launchLabel,
                    row.audienceDescriptor,
                    row.objective,
                    row.amountSpent,
                    row.amountSpentDeltaPct,
                    row.leads,
                    row.leadsDeltaPct,
                    row.costPerLead,
                    row.costPerLeadDeltaPct,
                    row.ctrLink,
                    row.ctrLinkDeltaPct,
                    row.performanceScore,
                    row.performanceStatus,
                  ])
                )
              }
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono"
              style={{
                background: "var(--dash-panel-soft)",
                border: "1px solid var(--dash-border)",
                color: "var(--dash-text)",
              }}
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>

          {isCampaignsLoading ? (
            <div className="rounded-xl border px-4 py-8 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
              Loading campaigns…
            </div>
          ) : campaignRows.length === 0 ? (
            <div className="rounded-xl border px-4 py-8 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
              No campaigns match the current filters.
            </div>
          ) : (
            <div className="space-y-4">
              {campaignRows.map(row => {
                const isOpen = row.id === selectedCampaignId;
                const campaignLabel = getPreferredCampaignLabel({
                  rawName: row.name,
                  displayName: row.displayName,
                  editorCode: row.editorCode,
                  campaignDescriptor: row.campaignDescriptor,
                });

                return (
                  <div
                    key={row.id}
                    className="overflow-hidden rounded-2xl border"
                    style={{
                      borderColor: isOpen ? "color-mix(in srgb, var(--color-cyan) 35%, var(--dash-border))" : "var(--dash-border)",
                      background: isOpen ? "color-mix(in srgb, var(--color-cyan) 6%, var(--dash-panel))" : "var(--dash-panel-soft)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isOpen) {
                          setSelectedCampaignId(null);
                          setSelectedAdsetId(null);
                          return;
                        }

                        setSelectedCampaignId(row.id);
                        setSelectedAdsetId(null);
                      }}
                      className="w-full px-4 py-4 text-left"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,2.3fr)_repeat(4,minmax(0,1fr))_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <span style={{ color: isOpen ? "#00D4FF" : "var(--dash-subtle)" }}>
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <div className="min-w-0">
                              <div className="text-base font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}>
                                {campaignLabel}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {row.editorCode ? <MiniTag label={row.editorCode} /> : null}
                                {row.launchLabel ? <MiniTag label={row.launchLabel} /> : null}
                                {row.audienceDescriptor ? <MiniTag label={row.audienceDescriptor} /> : null}
                                <MiniTag label={row.objective} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <BreakdownMetric label="Spend" value={formatCurrency(row.amountSpent)} />
                        <BreakdownMetric label="Leads" value={row.leads.toLocaleString()} />
                        <BreakdownMetric label="CPL" value={row.costPerLead != null ? formatCurrency(row.costPerLead) : "No leads"} />
                        <BreakdownMetric label="Score" value={`${row.performanceScore}/100`} />
                        <div className="flex items-center justify-start lg:justify-end">
                          <StatusBadge status={row.performanceStatus} size="sm" />
                        </div>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t px-4 py-4" style={{ borderColor: "var(--dash-border)" }}>
                        <RecommendationCallout entity={row} title={`Campaign readout for ${campaignLabel}`} />

                        <div className="mt-4">
                          <div className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em]" style={{ color: "var(--dash-muted)" }}>
                            <Layers3 size={12} />
                            Ad Set Breakdown
                          </div>

                          {isAdsetsLoading ? (
                            <div className="rounded-xl border px-4 py-6 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
                              Loading ad sets…
                            </div>
                          ) : adsetRows.length === 0 ? (
                            <div className="rounded-xl border px-4 py-6 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
                              No ad sets found for this campaign in the current range.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {adsetRows.map(adset => {
                                const adsetOpen = adset.id === selectedAdsetId;

                                return (
                                  <div
                                    key={adset.id}
                                    className="overflow-hidden rounded-xl border"
                                    style={{
                                      borderColor: adsetOpen ? "color-mix(in srgb, #00E676 24%, var(--dash-border))" : "var(--dash-border)",
                                      background: adsetOpen ? "color-mix(in srgb, #00E676 6%, var(--dash-panel))" : "var(--dash-panel)",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedAdsetId(current => (current === adset.id ? null : adset.id))
                                      }
                                      className="w-full px-4 py-4 text-left"
                                    >
                                      <div className="grid gap-3 md:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_auto] md:items-center">
                                        <div className="min-w-0">
                                          <div className="flex items-start gap-3">
                                            <span style={{ color: adsetOpen ? "#00E676" : "var(--dash-subtle)" }}>
                                              {adsetOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                            </span>
                                            <div className="min-w-0">
                                              <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}>
                                                {adset.name}
                                              </div>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {adset.optimizationGoal ? <MiniTag label={adset.optimizationGoal} /> : null}
                                                {adset.billingEvent ? <MiniTag label={adset.billingEvent} /> : null}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <BreakdownMetric label="Spend" value={formatCurrency(adset.amountSpent)} />
                                        <BreakdownMetric label="Leads" value={adset.leads.toLocaleString()} />
                                        <BreakdownMetric label="CPL" value={adset.costPerLead != null ? formatCurrency(adset.costPerLead) : "No leads"} />
                                        <BreakdownMetric label="Score" value={`${adset.performanceScore}/100`} />
                                        <div className="flex items-center justify-start md:justify-end">
                                          <StatusBadge status={adset.performanceStatus} size="sm" />
                                        </div>
                                      </div>
                                    </button>

                                    {adsetOpen ? (
                                      <div className="border-t px-4 py-4" style={{ borderColor: "var(--dash-border)" }}>
                                        <RecommendationCallout entity={adset} title={`Ad set readout for ${adset.name}`} />

                                        <div className="mt-4">
                                          <div className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em]" style={{ color: "var(--dash-muted)" }}>
                                            <Waypoints size={12} />
                                            Ad Breakdown
                                          </div>

                                          {isAdsLoading ? (
                                            <div className="rounded-xl border px-4 py-6 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
                                              Loading ads…
                                            </div>
                                          ) : adRows.length === 0 ? (
                                            <div className="rounded-xl border px-4 py-6 text-center text-sm font-mono" style={{ borderColor: "var(--dash-border)", color: "var(--dash-muted)" }}>
                                              No ads found for this ad set in the current range.
                                            </div>
                                          ) : (
                                            <div className="space-y-3">
                                              {adRows.map(ad => (
                                                <div
                                                  key={ad.id}
                                                  className="rounded-xl border px-4 py-4"
                                                  style={{ borderColor: "var(--dash-border)", background: "var(--dash-panel-soft)" }}
                                                >
                                                  <div className="grid gap-3 lg:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-start">
                                                    <div className="min-w-0">
                                                      <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--dash-text)" }}>
                                                        {ad.name}
                                                      </div>
                                                      <div className="mt-1 text-xs font-mono" style={{ color: "var(--dash-muted)" }}>
                                                        {ad.creativeName ?? ad.creativeId ?? "No creative label"}
                                                      </div>
                                                      <div className="mt-3 text-sm leading-relaxed" style={{ color: "var(--dash-text-soft)" }}>
                                                        {ad.recommendation}
                                                      </div>
                                                    </div>
                                                    <BreakdownMetric label="Spend" value={formatCurrency(ad.amountSpent)} />
                                                    <BreakdownMetric label="Leads" value={ad.leads.toLocaleString()} />
                                                    <BreakdownMetric label="CPL" value={ad.costPerLead != null ? formatCurrency(ad.costPerLead) : "No leads"} />
                                                    <BreakdownMetric label="CTR Δ" value={formatDelta(ad.ctrLinkDeltaPct)} />
                                                    <div className="flex items-center justify-start lg:justify-end">
                                                      <StatusBadge status={ad.performanceStatus} size="sm" />
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
