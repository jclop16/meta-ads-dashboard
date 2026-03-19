import { getDemoDailyPerformance, getDemoFetchedDataset } from "./demoData";
import { ENV } from "./_core/env";

export const DATE_PRESETS = [
  { preset: "last_30d", label: "Last 30 Days", isPartial: false },
  { preset: "last_7d", label: "Last 7 Days", isPartial: false },
  { preset: "this_week_mon_today", label: "This Week", isPartial: true },
  { preset: "today", label: "Today", isPartial: true },
  { preset: "yesterday", label: "Yesterday", isPartial: false },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["preset"];

export type MetaAccountProfile = {
  id: string;
  name: string;
  currency: string;
};

export interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  inline_link_clicks: string;
  ctr: string;
  inline_link_click_ctr: string;
  cpm: string;
  cpc: string;
  cost_per_inline_link_click: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface FetchedSnapshot {
  datePreset: string;
  datePresetLabel: string;
  dateRangeSince: string;
  dateRangeUntil: string;
  isPartial: boolean;
  account: {
    amountSpent: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicksAll: number;
    linkClicks: number;
    ctrAll: number;
    ctrLink: number;
    cpm: number;
    cpcAll: number;
    cpcLink: number;
    leads: number;
    costPerLead: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    shortName: string;
    objective: string;
    status: string;
    amountSpent: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicksAll: number;
    linkClicks: number;
    ctrAll: number;
    ctrLink: number;
    cpm: number;
    cpcAll: number;
    cpcLink: number;
    leads: number;
    costPerLead: number | null;
  }>;
}

export interface DailyPerformancePoint {
  date: string;
  label: string;
  amountSpent: number;
  leads: number;
  costPerLead: number | null;
}

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string; code?: number; type?: string };
};

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const LEAD_ACTION_TYPES = new Set([
  "lead",
  "leadgen_grouped",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.lead",
  "omni_lead",
  "onsite_web_lead",
]);

const INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "inline_link_click_ctr",
  "cpm",
  "cpc",
  "cost_per_inline_link_click",
  "actions",
  "date_start",
  "date_stop",
].join(",");

function safeFloat(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeInt(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toShortName(name: string) {
  return name
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function inferObjective(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("annuity")) return "Annuity";
  if (lower.includes("fegli") && lower.includes("trap")) return "FEGLI Trap";
  if (lower.includes("fegli") && lower.includes("conversion")) {
    return "FEGLI Conversion";
  }
  if (lower.includes("fegli")) return "FEGLI Trap";
  return "Other";
}

function parseLeads(row: MetaInsightRow) {
  const leadAction = row.actions?.find(action =>
    LEAD_ACTION_TYPES.has(action.action_type)
  );

  return leadAction ? safeInt(leadAction.value) : 0;
}

function normalizeAdAccountId(value: string) {
  if (!value) return "";
  return value.startsWith("act_") ? value : `act_${value}`;
}

function formatDayLabel(isoDate: string) {
  return DAY_LABEL_FORMATTER.format(new Date(`${isoDate}T00:00:00Z`));
}

export function isMetaApiConfigured() {
  return Boolean(ENV.metaAccessToken && ENV.metaAdAccountId);
}

function buildGraphUrl(pathOrUrl: string, params?: Record<string, string>) {
  const url = pathOrUrl.startsWith("https://")
    ? new URL(pathOrUrl)
    : new URL(
        `${ENV.metaGraphBaseUrl}/${pathOrUrl.replace(/^\/+/, "")}`
      );

  if (!url.searchParams.has("access_token")) {
    url.searchParams.set("access_token", ENV.metaAccessToken);
  }

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

async function fetchGraphJson<T>(
  pathOrUrl: string,
  params?: Record<string, string>
): Promise<T> {
  const url = buildGraphUrl(pathOrUrl, params);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json()) as GraphPage<unknown> | T;

  if (!response.ok || (payload as GraphPage<unknown>).error) {
    const error = (payload as GraphPage<unknown>).error;
    const detail = error?.message ?? response.statusText;
    throw new Error(`Meta Graph API request failed: ${detail}`);
  }

  return payload as T;
}

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const rows: T[] = [];
  let nextPath: string | null = path;
  let nextParams: Record<string, string> | undefined = params;

  while (nextPath) {
    const page: GraphPage<T> = await fetchGraphJson<GraphPage<T>>(
      nextPath,
      nextParams
    );
    rows.push(...(page.data ?? []));
    nextPath = page.paging?.next ?? null;
    nextParams = undefined;
  }

  return rows;
}

async function fetchAccountProfile(): Promise<MetaAccountProfile> {
  const profile = await fetchGraphJson<{
    id: string;
    name?: string;
    currency?: string;
  }>(normalizeAdAccountId(ENV.metaAdAccountId), {
    fields: "id,name,currency",
  });

  return {
    id: profile.id,
    name: profile.name ?? ENV.metaAccountName ?? "Meta Ad Account",
    currency: profile.currency ?? "USD",
  };
}

async function fetchInsightsForPreset(
  preset: string,
  level: "account" | "campaign"
) {
  return fetchAllPages<MetaInsightRow>(
    `${normalizeAdAccountId(ENV.metaAdAccountId)}/insights`,
    {
      level,
      date_preset: preset,
      fields: INSIGHTS_FIELDS,
      limit: level === "campaign" ? "250" : "50",
    }
  );
}

async function fetchDailyInsightsForPreset(preset: string) {
  return fetchAllPages<MetaInsightRow>(
    `${normalizeAdAccountId(ENV.metaAdAccountId)}/insights`,
    {
      level: "account",
      date_preset: preset,
      time_increment: "1",
      fields: INSIGHTS_FIELDS,
      limit: "90",
    }
  );
}

export async function fetchSnapshotForPreset(
  preset: string,
  label: string,
  isPartial: boolean
): Promise<FetchedSnapshot> {
  const accountRows = await fetchInsightsForPreset(preset, "account");
  const accountRow = accountRows[0];

  if (!accountRow) {
    throw new Error(`No account data returned for preset ${preset}`);
  }

  const accountLeads = parseLeads(accountRow);
  const accountSpent = safeFloat(accountRow.spend);

  const campaignRows = await fetchInsightsForPreset(preset, "campaign");
  const campaigns = campaignRows.map(row => {
    const leads = parseLeads(row);
    const amountSpent = safeFloat(row.spend);
    const costPerLead = leads > 0 ? amountSpent / leads : null;

    return {
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name ?? "",
      shortName: toShortName(row.campaign_name ?? ""),
      objective: inferObjective(row.campaign_name ?? ""),
      status: "moderate",
      amountSpent,
      impressions: safeInt(row.impressions),
      reach: safeInt(row.reach),
      frequency: safeFloat(row.frequency),
      clicksAll: safeInt(row.clicks),
      linkClicks: safeInt(row.inline_link_clicks),
      ctrAll: safeFloat(row.ctr),
      ctrLink: safeFloat(row.inline_link_click_ctr),
      cpm: safeFloat(row.cpm),
      cpcAll: safeFloat(row.cpc),
      cpcLink: safeFloat(row.cost_per_inline_link_click),
      leads,
      costPerLead:
        costPerLead != null ? Number(costPerLead.toFixed(2)) : null,
    };
  });

  return {
    datePreset: preset,
    datePresetLabel: label,
    dateRangeSince: accountRow.date_start,
    dateRangeUntil: accountRow.date_stop,
    isPartial,
    account: {
      amountSpent: accountSpent,
      impressions: safeInt(accountRow.impressions),
      reach: safeInt(accountRow.reach),
      frequency: safeFloat(accountRow.frequency),
      clicksAll: safeInt(accountRow.clicks),
      linkClicks: safeInt(accountRow.inline_link_clicks),
      ctrAll: safeFloat(accountRow.ctr),
      ctrLink: safeFloat(accountRow.inline_link_click_ctr),
      cpm: safeFloat(accountRow.cpm),
      cpcAll: safeFloat(accountRow.cpc),
      cpcLink: safeFloat(accountRow.cost_per_inline_link_click),
      leads: accountLeads,
      costPerLead:
        accountLeads > 0
          ? Number((accountSpent / accountLeads).toFixed(2))
          : 0,
    },
    campaigns,
  };
}

export async function fetchAllSnapshots(): Promise<{
  account: MetaAccountProfile;
  snapshots: FetchedSnapshot[];
  sourceMode: "live" | "demo";
}> {
  if (!isMetaApiConfigured()) {
    return getDemoFetchedDataset();
  }

  const account = await fetchAccountProfile();
  const snapshots: FetchedSnapshot[] = [];

  for (const preset of DATE_PRESETS) {
    const snapshot = await fetchSnapshotForPreset(
      preset.preset,
      preset.label,
      preset.isPartial
    );
    snapshots.push(snapshot);
  }

  return {
    account,
    snapshots,
    sourceMode: "live",
  };
}

export async function fetchDailyPerformance(): Promise<{
  days: DailyPerformancePoint[];
  sourceMode: "live" | "demo";
}> {
  if (!isMetaApiConfigured()) {
    return {
      days: getDemoDailyPerformance(),
      sourceMode: "demo",
    };
  }

  const rows = await fetchDailyInsightsForPreset("last_30d");

  return {
    days: rows
      .map(row => {
        const amountSpent = safeFloat(row.spend);
        const leads = parseLeads(row);

        return {
          date: row.date_start,
          label: formatDayLabel(row.date_start),
          amountSpent: Number(amountSpent.toFixed(2)),
          leads,
          costPerLead:
            leads > 0 ? Number((amountSpent / leads).toFixed(2)) : null,
        };
      })
      .sort((left, right) => left.date.localeCompare(right.date)),
    sourceMode: "live",
  };
}
