import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, Download, Filter, Layers3, LineChart, Search, Target, Waypoints } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCplTarget } from "@/contexts/CplTargetContext";
import StatusBadge from "@/components/StatusBadge";

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
        background: "#13161E",
        border: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
      }}
    >
      <p className="mb-1" style={{ color: "#94A3B8" }}>
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#94A3B8",
      }}
    >
      <span style={{ color: "#475569" }}>{label}: </span>
      <span style={{ color: "#E2E8F0" }}>{value ?? "—"}</span>
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
        background: "rgba(19,22,30,0.9)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
      }}
    >
      <div className="mb-4">
        <h2
          className="text-sm font-semibold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#F1F5F9" }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs font-mono" style={{ color: "#64748B" }}>
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
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#94A3B8",
      }}
    >
      {label}
    </span>
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

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(0,212,255,0.08), transparent 28%), #0D0F14",
      }}
    >
      <header
        className="sticky top-0 z-40 border-b px-4 py-4"
        style={{
          background: "rgba(13,15,20,0.92)",
          borderColor: "rgba(255,255,255,0.05)",
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
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#F8FAFC" }}
            >
              Meta Explorer
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
              Drill from campaign to ad set to ad before introducing Meta write actions.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <a
              href="/"
              className="rounded-lg px-3 py-2 transition-colors hover:brightness-125"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#CBD5E1",
              }}
            >
              Executive Summary
            </a>
            <a
              href="/history"
              className="rounded-lg px-3 py-2 transition-colors hover:brightness-125"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#CBD5E1",
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
            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
              <span className="inline-flex items-center gap-1"><Filter size={12} /> Date Shortcut</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
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

            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
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
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
                }}
              />
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
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
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
                }}
              />
            </label>

            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
              <span>Objective</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
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

            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
              <span>Status</span>
              <select
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
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

            <label className="space-y-1 text-xs font-mono" style={{ color: "#64748B" }}>
              <span className="inline-flex items-center gap-1"><Search size={12} /> Name Search</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Campaign, ad set, or ad"
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#E2E8F0",
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={value => `$${value}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#64748B", fontSize: 11 }}
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
            title="Selection Context"
            subtitle="The trend starts at filtered account scope. Click a campaign row to drill into ad sets, then an ad set to load ads."
          >
            <div className="grid gap-3">
              <FilterPill label="Selected Campaign" value={selectedCampaign?.displayName ?? "None"} />
              <FilterPill label="Selected Ad Set" value={selectedAdset?.name ?? "None"} />
              <FilterPill label="Editor" value={selectedCampaign?.editorCode ?? selectedAdset?.editorCode ?? "—"} />
              <FilterPill label="Launch" value={selectedCampaign?.launchLabel ?? selectedAdset?.launchLabel ?? "—"} />
              <FilterPill label="Audience" value={selectedCampaign?.audienceDescriptor ?? selectedAdset?.audienceDescriptor ?? "—"} />
              <FilterPill
                label="Current Campaign CPL"
                value={
                  selectedCampaign?.costPerLead != null
                    ? formatCurrency(selectedCampaign.costPerLead)
                    : "N/A"
                }
              />
              <FilterPill
                label="Current Ad Set CPL"
                value={
                  selectedAdset?.costPerLead != null
                    ? formatCurrency(selectedAdset.costPerLead)
                    : "N/A"
                }
              />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr_1fr]">
          <SectionCard
            title="Campaign Breakdown"
            subtitle="Primary list for filtered scope. Sorted by spend."
          >
            <div className="mb-3 flex justify-end">
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
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#CBD5E1",
                }}
              >
                <Download size={12} />
                Export CSV
              </button>
            </div>
            <DataTable
              icon={<Target size={13} />}
              loading={isCampaignsLoading}
              headers={["Campaign", "Objective", "Spend", "Spend Δ", "Leads", "Leads Δ", "CPL", "CPL Δ", "CTR Δ", "Status"]}
              tableMinWidthClassName="min-w-[1100px]"
              rows={campaignRows.map(row => ({
                key: row.id,
                selected: row.id === selectedCampaignId,
                onClick: () => {
                  if (row.id === selectedCampaignId) {
                    setSelectedCampaignId(null);
                    setSelectedAdsetId(null);
                    return;
                  }

                  setSelectedCampaignId(row.id);
                  setSelectedAdsetId(null);
                },
                cells: [
                  <div className="min-w-[16rem]">
                    <p className="font-semibold" style={{ color: "#F8FAFC" }}>
                      {getPreferredCampaignLabel({
                        rawName: row.name,
                        displayName: row.displayName,
                        editorCode: row.editorCode,
                        campaignDescriptor: row.campaignDescriptor,
                      })}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.editorCode ? <MiniTag label={row.editorCode} /> : null}
                      {row.launchLabel ? <MiniTag label={row.launchLabel} /> : null}
                      {row.audienceDescriptor ? <MiniTag label={row.audienceDescriptor} /> : null}
                    </div>
                  </div>,
                  row.objective,
                  formatCurrency(row.amountSpent),
                  formatDelta(row.amountSpentDeltaPct ?? null),
                  row.leads.toLocaleString(),
                  formatDelta(row.leadsDeltaPct ?? null),
                  row.costPerLead != null ? formatCurrency(row.costPerLead) : "N/A",
                  formatDelta(row.costPerLeadDeltaPct ?? null, true),
                  formatDelta(row.ctrLinkDeltaPct ?? null),
                  <StatusBadge status={row.performanceStatus} size="sm" />,
                ],
              }))}
              emptyLabel="No campaigns match the current filters."
            />
          </SectionCard>

          <SectionCard
            title="Ad Set Breakdown"
            subtitle={selectedCampaign ? `Scoped to ${selectedCampaign.displayName}` : "Select a campaign to inspect ad sets."}
          >
            <DataTable
              icon={<Layers3 size={13} />}
              loading={Boolean(selectedCampaignId) && isAdsetsLoading}
              headers={["Ad Set", "Spend", "Spend Δ", "Leads", "Leads Δ", "CPL", "CPL Δ", "CTR Δ", "Status"]}
              tableMinWidthClassName="min-w-[980px]"
              rows={adsetRows.map(row => ({
                key: row.id,
                selected: row.id === selectedAdsetId,
                onClick: () =>
                  setSelectedAdsetId(current => (current === row.id ? null : row.id)),
                cells: [
                  <div className="min-w-[18rem]">
                    <p className="font-semibold" style={{ color: "#F8FAFC" }}>
                      {row.name}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: "#475569" }}>
                      {row.optimizationGoal ?? "No optimization goal"}
                    </p>
                  </div>,
                  formatCurrency(row.amountSpent),
                  formatDelta(row.amountSpentDeltaPct ?? null),
                  row.leads.toLocaleString(),
                  formatDelta(row.leadsDeltaPct ?? null),
                  row.costPerLead != null ? formatCurrency(row.costPerLead) : "N/A",
                  formatDelta(row.costPerLeadDeltaPct ?? null, true),
                  formatDelta(row.ctrLinkDeltaPct ?? null),
                  <StatusBadge status={row.performanceStatus} size="sm" />,
                ],
              }))}
              emptyLabel={
                selectedCampaignId
                  ? "No ad sets found for the selected campaign in this range."
                  : "Select a campaign to load ad sets."
              }
            />
          </SectionCard>

          <SectionCard
            title="Ad Breakdown"
            subtitle={selectedAdset ? `Scoped to ${selectedAdset.name}` : "Select an ad set to inspect ads."}
          >
            <DataTable
              icon={<Waypoints size={13} />}
              loading={Boolean(selectedAdsetId) && isAdsLoading}
              headers={["Ad", "Spend", "Spend Δ", "Leads", "Leads Δ", "CPL", "CPL Δ", "CTR Δ", "Status"]}
              tableMinWidthClassName="min-w-[1080px]"
              rows={adRows.map(row => ({
                key: row.id,
                cells: [
                  <div className="min-w-[20rem]">
                    <p className="font-semibold" style={{ color: "#F8FAFC" }}>
                      {row.name}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: "#475569" }}>
                      {row.creativeName ?? row.creativeId ?? "No creative label"}
                    </p>
                  </div>,
                  formatCurrency(row.amountSpent),
                  formatDelta(row.amountSpentDeltaPct ?? null),
                  row.leads.toLocaleString(),
                  formatDelta(row.leadsDeltaPct ?? null),
                  row.costPerLead != null ? formatCurrency(row.costPerLead) : "N/A",
                  formatDelta(row.costPerLeadDeltaPct ?? null, true),
                  formatDelta(row.ctrLinkDeltaPct ?? null),
                  <StatusBadge status={row.performanceStatus} size="sm" />,
                ],
              }))}
              emptyLabel={
                selectedAdsetId
                  ? "No ads found for the selected ad set in this range."
                  : "Select an ad set to load ads."
              }
            />
          </SectionCard>
        </div>
      </main>
    </div>
  );
}

function DataTable({
  icon,
  headers,
  rows,
  loading,
  emptyLabel,
  tableMinWidthClassName = "min-w-[960px]",
}: {
  icon: ReactNode;
  headers: string[];
  rows: Array<{
    key: string;
    selected?: boolean;
    onClick?: () => void;
    cells: ReactNode[];
  }>;
  loading: boolean;
  emptyLabel: string;
  tableMinWidthClassName?: string;
}) {
  return (
    <div className="max-w-full rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div
        className="flex items-center gap-2 border-b px-4 py-3 text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{
          borderColor: "rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.03)",
          color: "#64748B",
        }}
      >
        {icon}
        Live Aggregation
      </div>

      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className={`w-full ${tableMinWidthClassName}`}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {headers.map(header => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-[0.16em]"
                  style={{ color: "#475569" }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-sm font-mono"
                  style={{ color: "#64748B" }}
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-sm font-mono"
                  style={{ color: "#64748B" }}
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.key}
                  onClick={row.onClick}
                  style={{
                    cursor: row.onClick ? "pointer" : "default",
                    background: row.selected ? "rgba(0,212,255,0.07)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.key}-${index}`}
                      className="px-4 py-3 align-top text-sm font-mono"
                      style={{ color: "#CBD5E1" }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
