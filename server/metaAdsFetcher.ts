import { getDemoDailyPerformance, getDemoFetchedDataset } from "./demoData";
import { ENV } from "./_core/env";
import {
  parseCampaignIdentity,
  toShortName,
} from "./reportingAnalysis";

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
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
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

export interface NormalizedMetricFact {
  accountId: string;
  date: string;
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
}

export interface NormalizedCampaignEntity {
  id: string;
  accountId: string;
  name: string;
  shortName: string;
  displayName: string;
  editorCode: string | null;
  campaignDescriptor: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
  objective: string;
  status: string | null;
  effectiveStatus: string | null;
}

export interface NormalizedAdsetEntity {
  id: string;
  accountId: string;
  campaignId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
}

export interface NormalizedAdEntity {
  id: string;
  accountId: string;
  campaignId: string;
  adsetId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creativeId: string | null;
  creativeName: string | null;
}

export interface NormalizedCampaignFact extends NormalizedMetricFact {
  campaignId: string;
}

export interface NormalizedAdsetFact extends NormalizedMetricFact {
  campaignId: string;
  adsetId: string;
}

export interface NormalizedAdFact extends NormalizedMetricFact {
  campaignId: string;
  adsetId: string;
  adId: string;
}

export interface NormalizedMetaDataset {
  account: MetaAccountProfile;
  campaigns: NormalizedCampaignEntity[];
  adsets: NormalizedAdsetEntity[];
  ads: NormalizedAdEntity[];
  campaignFacts: NormalizedCampaignFact[];
  adsetFacts: NormalizedAdsetFact[];
  adFacts: NormalizedAdFact[];
  availableDataSince: string | null;
  availableDataUntil: string | null;
  sourceMode: "live" | "demo";
  fetchedAt: Date;
}

export interface MetaConnectionStatus {
  configured: boolean;
  connected: boolean;
  sourceMode: "live" | "demo";
  apiVersion: string;
  adAccountId: string | null;
  checkedAt: Date;
  account: MetaAccountProfile | null;
  sampleDateStart: string | null;
  sampleDateStop: string | null;
  errorMessage: string | null;
  errorCode: number | null;
  errorType: string | null;
  errorSubcode: number | null;
  fbtraceId: string | null;
}

type GraphApiErrorPayload = {
  message: string;
  code?: number;
  type?: string;
  error_subcode?: number;
  fbtrace_id?: string;
  error_user_title?: string;
  error_user_msg?: string;
};

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: GraphApiErrorPayload;
};

type MetaCampaignNode = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
};

type MetaAdsetNode = {
  id: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
  billing_event?: string;
};

type MetaAdNode = {
  id: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  status?: string;
  effective_status?: string;
  creative?: {
    id?: string;
    name?: string;
  };
};

export type NormalizedSyncMode = "hot" | "reconcile";

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const HOT_FACT_LOOKBACK_DAYS = 45;
export const RECONCILIATION_FACT_LOOKBACK_DAYS = 365;
const FACT_WINDOW_DAYS = {
  campaign: 30,
  adset: 21,
  ad: 14,
} as const;

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

const ADSET_INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
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

const AD_INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
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

function startOfUtcDay(date: Date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildTimeWindowsForRange(
  sinceDate: Date,
  untilDate: Date,
  windowDays: number
) {
  const windows: Array<{ since: string; until: string }> = [];
  let cursor = startOfUtcDay(sinceDate);
  const finalDay = startOfUtcDay(untilDate);

  while (cursor.getTime() <= finalDay.getTime()) {
    const candidateUntil = addUtcDays(cursor, windowDays - 1);
    const until =
      candidateUntil.getTime() <= finalDay.getTime() ? candidateUntil : finalDay;

    windows.push({
      since: formatIsoDate(cursor),
      until: formatIsoDate(until),
    });

    cursor = addUtcDays(until, 1);
  }

  return windows;
}

export function isMetaApiConfigured() {
  return Boolean(ENV.metaAccessToken && ENV.metaAdAccountId);
}

export class MetaGraphApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly type: string | null;
  readonly subcode: number | null;
  readonly fbtraceId: string | null;
  readonly requestPath: string;

  constructor(input: {
    message: string;
    status: number;
    code?: number;
    type?: string;
    subcode?: number;
    fbtraceId?: string;
    requestPath: string;
  }) {
    super(input.message);
    this.name = "MetaGraphApiError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.type = input.type ?? null;
    this.subcode = input.subcode ?? null;
    this.fbtraceId = input.fbtraceId ?? null;
    this.requestPath = input.requestPath;
  }
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

function buildMetaGraphApiError(
  requestPath: string,
  status: number,
  payload: GraphApiErrorPayload | null,
  responseBodyPreview?: string
) {
  const detailParts = [
    payload?.message,
    payload?.error_user_title,
    payload?.error_user_msg,
    responseBodyPreview,
  ].filter(Boolean);
  const metadataParts = [
    status ? `status=${status}` : null,
    payload?.code != null ? `code=${payload.code}` : null,
    payload?.type ? `type=${payload.type}` : null,
    payload?.error_subcode != null ? `subcode=${payload.error_subcode}` : null,
    payload?.fbtrace_id ? `fbtrace_id=${payload.fbtrace_id}` : null,
  ].filter(Boolean);

  return new MetaGraphApiError({
    message: `Meta Graph API request failed for ${requestPath}: ${detailParts.join(" | ") || "Unknown error"}${metadataParts.length ? ` [${metadataParts.join(", ")}]` : ""}`,
    status,
    code: payload?.code,
    type: payload?.type,
    subcode: payload?.error_subcode,
    fbtraceId: payload?.fbtrace_id,
    requestPath,
  });
}

function getMetaErrorDetails(error: unknown) {
  if (error instanceof MetaGraphApiError) {
    return {
      errorMessage: error.message,
      errorCode: error.code,
      errorType: error.type,
      errorSubcode: error.subcode,
      fbtraceId: error.fbtraceId,
    };
  }

  return {
    errorMessage:
      error instanceof Error ? error.message : "Unknown Meta connection error",
    errorCode: null,
    errorType: null,
    errorSubcode: null,
    fbtraceId: null,
  };
}

async function fetchGraphJson<T>(
  pathOrUrl: string,
  params?: Record<string, string>
): Promise<T> {
  const url = buildGraphUrl(pathOrUrl, params);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ENV.metaRequestTimeoutMs
  );
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Meta Graph API request timed out after ${ENV.metaRequestTimeoutMs}ms for ${url.pathname}`
      );
    }

    const detail =
      error instanceof Error ? error.message : "Unknown network error";
    throw new Error(
      `Meta Graph API network request failed for ${url.pathname}: ${detail}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let payload: GraphPage<unknown> | T | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as GraphPage<unknown> | T;
    } catch {
      if (!response.ok) {
        throw buildMetaGraphApiError(
          url.pathname,
          response.status,
          null,
          rawBody.slice(0, 280)
        );
      }

      throw new Error(
        `Meta Graph API returned a non-JSON response for ${url.pathname}`
      );
    }
  }

  if (!response.ok || (payload as GraphPage<unknown> | null)?.error) {
    const error = (payload as GraphPage<unknown> | null)?.error ?? null;
    throw buildMetaGraphApiError(
      url.pathname,
      response.status,
      error,
      !error && rawBody ? rawBody.slice(0, 280) : undefined
    );
  }

  return (payload ?? {}) as T;
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

async function fetchCampaignMetadata() {
  return fetchAllPages<MetaCampaignNode>(
    `${normalizeAdAccountId(ENV.metaAdAccountId)}/campaigns`,
    {
      fields: "id,name,objective,status,effective_status",
      limit: "250",
    }
  );
}

async function fetchAdsetMetadata() {
  return fetchAllPages<MetaAdsetNode>(
    `${normalizeAdAccountId(ENV.metaAdAccountId)}/adsets`,
    {
      fields:
        "id,name,campaign_id,status,effective_status,optimization_goal,billing_event",
      limit: "500",
    }
  );
}

async function fetchAdMetadata() {
  return fetchAllPages<MetaAdNode>(
    `${normalizeAdAccountId(ENV.metaAdAccountId)}/ads`,
    {
      fields: "id,name,campaign_id,adset_id,status,effective_status,creative{id,name}",
      limit: "500",
    }
  );
}

function resolveNormalizedRange(mode: NormalizedSyncMode) {
  const today = startOfUtcDay(new Date());

  if (mode === "reconcile") {
    return {
      since: addUtcDays(today, -(RECONCILIATION_FACT_LOOKBACK_DAYS - 1)),
      until: addUtcDays(today, -HOT_FACT_LOOKBACK_DAYS),
    };
  }

  return {
    since: addUtcDays(today, -(HOT_FACT_LOOKBACK_DAYS - 1)),
    until: today,
  };
}

async function fetchRollingDailyInsights(
  level: "campaign" | "adset" | "ad",
  mode: NormalizedSyncMode
) {
  const fields =
    level === "campaign"
      ? INSIGHTS_FIELDS
      : level === "adset"
        ? ADSET_INSIGHTS_FIELDS
        : AD_INSIGHTS_FIELDS;

  const rows: MetaInsightRow[] = [];
  const range = resolveNormalizedRange(mode);
  if (range.until.getTime() < range.since.getTime()) {
    return rows;
  }
  const windows = buildTimeWindowsForRange(
    range.since,
    range.until,
    FACT_WINDOW_DAYS[level]
  );

  for (const window of windows) {
    try {
      const pageRows = await fetchAllPages<MetaInsightRow>(
        `${normalizeAdAccountId(ENV.metaAdAccountId)}/insights`,
        {
          level,
          time_increment: "1",
          time_range: JSON.stringify({
            since: window.since,
            until: window.until,
          }),
          fields,
          limit: level === "ad" ? "500" : "250",
        }
      );

      rows.push(...pageRows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Meta API error";
      throw new Error(
        `${message} (window ${window.since}..${window.until}, level ${level})`
      );
    }
  }

  return rows;
}

function buildMetricFact(input: {
  accountId: string;
  date: string;
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
}) {
  return {
    accountId: input.accountId,
    date: input.date,
    amountSpent: Number(input.amountSpent.toFixed(2)),
    impressions: input.impressions,
    reach: input.reach,
    frequency: Number(input.frequency.toFixed(4)),
    clicksAll: input.clicksAll,
    linkClicks: input.linkClicks,
    ctrAll: Number(input.ctrAll.toFixed(4)),
    ctrLink: Number(input.ctrLink.toFixed(4)),
    cpm: Number(input.cpm.toFixed(4)),
    cpcAll: Number(input.cpcAll.toFixed(4)),
    cpcLink: Number(input.cpcLink.toFixed(4)),
    leads: input.leads,
    costPerLead:
      input.leads > 0
        ? Number((input.amountSpent / input.leads).toFixed(4))
        : null,
  };
}

function buildCampaignFacts(
  accountId: string,
  rows: MetaInsightRow[]
): NormalizedCampaignFact[] {
  return rows
    .filter(row => row.campaign_id && row.date_start)
    .map(row => {
      const amountSpent = safeFloat(row.spend);
      const leads = parseLeads(row);

      return {
        campaignId: row.campaign_id!,
        ...buildMetricFact({
          accountId,
          date: row.date_start,
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
        }),
      };
    });
}

function buildAdsetFacts(
  accountId: string,
  rows: MetaInsightRow[]
): NormalizedAdsetFact[] {
  return rows
    .filter(row => row.campaign_id && row.adset_id && row.date_start)
    .map(row => {
      const amountSpent = safeFloat(row.spend);
      const leads = parseLeads(row);

      return {
        campaignId: row.campaign_id!,
        adsetId: row.adset_id!,
        ...buildMetricFact({
          accountId,
          date: row.date_start,
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
        }),
      };
    });
}

function buildAdFacts(
  accountId: string,
  rows: MetaInsightRow[]
): NormalizedAdFact[] {
  return rows
    .filter(row => row.campaign_id && row.adset_id && row.ad_id && row.date_start)
    .map(row => {
      const amountSpent = safeFloat(row.spend);
      const leads = parseLeads(row);

      return {
        campaignId: row.campaign_id!,
        adsetId: row.adset_id!,
        adId: row.ad_id!,
        ...buildMetricFact({
          accountId,
          date: row.date_start,
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
        }),
      };
    });
}

function buildDemoNormalizedDataset(): NormalizedMetaDataset {
  const demo = getDemoFetchedDataset();
  const primary =
    demo.snapshots.find(snapshot => snapshot.datePreset === "last_30d") ??
    demo.snapshots[0];
  const accountId = demo.account.id;
  const dailyPoints = getDemoDailyPerformance();

  if (!primary) {
    return {
      account: demo.account,
      campaigns: [],
      adsets: [],
      ads: [],
      campaignFacts: [],
      adsetFacts: [],
      adFacts: [],
      availableDataSince: null,
      availableDataUntil: null,
      sourceMode: "demo",
      fetchedAt: new Date(),
    };
  }

  const totalSpend = primary.campaigns.reduce(
    (sum, campaign) => sum + campaign.amountSpent,
    0
  );
  const spendWeights = primary.campaigns.map(campaign =>
    totalSpend > 0 ? campaign.amountSpent / totalSpend : 0
  );
  const impressionWeights = primary.campaigns.map(campaign =>
    primary.account.impressions > 0
      ? campaign.impressions / primary.account.impressions
      : 0
  );
  const reachWeights = primary.campaigns.map(campaign =>
    primary.account.reach > 0 ? campaign.reach / primary.account.reach : 0
  );
  const clickWeights = primary.campaigns.map(campaign =>
    primary.account.clicksAll > 0
      ? campaign.clicksAll / primary.account.clicksAll
      : 0
  );
  const linkClickWeights = primary.campaigns.map(campaign =>
    primary.account.linkClicks > 0
      ? campaign.linkClicks / primary.account.linkClicks
      : 0
  );
  const leadWeights = primary.campaigns.map(campaign =>
    primary.account.leads > 0 ? campaign.leads / primary.account.leads : 0
  );

  const campaigns: NormalizedCampaignEntity[] = primary.campaigns.map(campaign => {
    const identity = parseCampaignIdentity(campaign.campaignName);

    return {
      id: campaign.campaignId,
      accountId,
      name: campaign.campaignName,
      shortName: identity.shortName,
      displayName: identity.displayName,
      editorCode: identity.editorCode,
      campaignDescriptor: identity.campaignDescriptor,
      launchLabel: identity.launchLabel,
      audienceDescriptor: identity.audienceDescriptor,
      objective: campaign.objective,
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
    };
  });

  const adsets: NormalizedAdsetEntity[] = primary.campaigns.map(campaign => ({
    id: `${campaign.campaignId}-adset-1`,
    accountId,
    campaignId: campaign.campaignId,
    name: `${campaign.shortName} Ad Set`,
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
  }));

  const ads: NormalizedAdEntity[] = primary.campaigns.map(campaign => ({
    id: `${campaign.campaignId}-ad-1`,
    accountId,
    campaignId: campaign.campaignId,
    adsetId: `${campaign.campaignId}-adset-1`,
    name: `${campaign.shortName} Ad`,
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    creativeId: null,
    creativeName: null,
  }));

  const campaignFacts: NormalizedCampaignFact[] = [];
  const adsetFacts: NormalizedAdsetFact[] = [];
  const adFacts: NormalizedAdFact[] = [];

  dailyPoints.forEach(day => {
    primary.campaigns.forEach((campaign, index) => {
      const amountSpent = day.amountSpent * (spendWeights[index] ?? 0);
      const impressions = Math.round(day.amountSpent > 0 ? day.amountSpent * 10 * (impressionWeights[index] ?? spendWeights[index] ?? 0) : 0) ||
        Math.round((primary.account.impressions / Math.max(dailyPoints.length, 1)) * (impressionWeights[index] ?? 0));
      const reach = Math.min(
        impressions,
        Math.round(
          (primary.account.reach / Math.max(dailyPoints.length, 1)) *
            (reachWeights[index] ?? spendWeights[index] ?? 0)
        )
      );
      const clicksAll = Math.round(
        (campaign.clicksAll / Math.max(dailyPoints.length, 1)) *
          ((clickWeights[index] ?? spendWeights[index] ?? 0) > 0 ? 1 : 0)
      );
      const linkClicks = Math.round(
        (campaign.linkClicks / Math.max(dailyPoints.length, 1)) *
          ((linkClickWeights[index] ?? spendWeights[index] ?? 0) > 0 ? 1 : 0)
      );
      const leads = Math.round(day.leads * (leadWeights[index] ?? 0));

      const factBase = buildMetricFact({
        accountId,
        date: day.date,
        amountSpent,
        impressions,
        reach,
        frequency: campaign.frequency,
        clicksAll,
        linkClicks,
        ctrAll: impressions > 0 ? (clicksAll / impressions) * 100 : campaign.ctrAll,
        ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : campaign.ctrLink,
        cpm: impressions > 0 ? (amountSpent / impressions) * 1000 : campaign.cpm,
        cpcAll: clicksAll > 0 ? amountSpent / clicksAll : campaign.cpcAll,
        cpcLink: linkClicks > 0 ? amountSpent / linkClicks : campaign.cpcLink,
        leads,
      });

      campaignFacts.push({
        campaignId: campaign.campaignId,
        ...factBase,
      });
      adsetFacts.push({
        campaignId: campaign.campaignId,
        adsetId: `${campaign.campaignId}-adset-1`,
        ...factBase,
      });
      adFacts.push({
        campaignId: campaign.campaignId,
        adsetId: `${campaign.campaignId}-adset-1`,
        adId: `${campaign.campaignId}-ad-1`,
        ...factBase,
      });
    });
  });

  return {
    account: demo.account,
    campaigns,
    adsets,
    ads,
    campaignFacts,
    adsetFacts,
    adFacts,
    availableDataSince: dailyPoints[0]?.date ?? null,
    availableDataUntil: dailyPoints.at(-1)?.date ?? null,
    sourceMode: "demo",
    fetchedAt: new Date(),
  };
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
    const identity = parseCampaignIdentity(row.campaign_name ?? "");

    return {
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name ?? "",
      shortName: identity.displayName,
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

export async function fetchNormalizedReportData(input?: {
  mode?: NormalizedSyncMode;
}): Promise<NormalizedMetaDataset> {
  const mode = input?.mode ?? "hot";

  if (!isMetaApiConfigured()) {
    return buildDemoNormalizedDataset();
  }

  const [account, campaignNodes, adsetNodes, adNodes, campaignRows, adsetRows, adRows] =
    await Promise.all([
      fetchAccountProfile(),
      fetchCampaignMetadata().catch(error => {
        throw new Error(
          `Normalized campaign metadata ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
      fetchAdsetMetadata().catch(error => {
        throw new Error(
          `Normalized ad set metadata ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
      fetchAdMetadata().catch(error => {
        throw new Error(
          `Normalized ad metadata ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
      fetchRollingDailyInsights("campaign", mode).catch(error => {
        throw new Error(
          `Normalized campaign fact ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
      fetchRollingDailyInsights("adset", mode).catch(error => {
        throw new Error(
          `Normalized ad set fact ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
      fetchRollingDailyInsights("ad", mode).catch(error => {
        throw new Error(
          `Normalized ad fact ingestion failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }),
    ]);

  const campaigns: NormalizedCampaignEntity[] = campaignNodes.map(node => {
    const identity = parseCampaignIdentity(node.name ?? node.id);

    return {
      id: node.id,
      accountId: account.id,
      name: node.name ?? node.id,
      shortName: identity.shortName,
      displayName: identity.displayName,
      editorCode: identity.editorCode,
      campaignDescriptor: identity.campaignDescriptor,
      launchLabel: identity.launchLabel,
      audienceDescriptor: identity.audienceDescriptor,
      objective: node.objective ?? inferObjective(node.name ?? ""),
      status: node.status ?? null,
      effectiveStatus: node.effective_status ?? null,
    };
  });

  const adsets: NormalizedAdsetEntity[] = adsetNodes
    .filter(node => node.campaign_id)
    .map(node => ({
      id: node.id,
      accountId: account.id,
      campaignId: node.campaign_id!,
      name: node.name ?? node.id,
      status: node.status ?? null,
      effectiveStatus: node.effective_status ?? null,
      optimizationGoal: node.optimization_goal ?? null,
      billingEvent: node.billing_event ?? null,
    }));

  const ads: NormalizedAdEntity[] = adNodes
    .filter(node => node.campaign_id && node.adset_id)
    .map(node => ({
      id: node.id,
      accountId: account.id,
      campaignId: node.campaign_id!,
      adsetId: node.adset_id!,
      name: node.name ?? node.id,
      status: node.status ?? null,
      effectiveStatus: node.effective_status ?? null,
      creativeId: node.creative?.id ?? null,
      creativeName: node.creative?.name ?? null,
    }));

  const availableFacts = buildCampaignFacts(account.id, campaignRows);
  const availableDataSince =
    availableFacts.length > 0
      ? availableFacts.reduce(
          (earliest, fact) => (fact.date < earliest ? fact.date : earliest),
          availableFacts[0].date
        )
      : null;
  const availableDataUntil =
    availableFacts.length > 0
      ? availableFacts.reduce(
          (latest, fact) => (fact.date > latest ? fact.date : latest),
          availableFacts[0].date
        )
      : null;

  return {
    account,
    campaigns,
    adsets,
    ads,
    campaignFacts: availableFacts,
    adsetFacts: buildAdsetFacts(account.id, adsetRows),
    adFacts: buildAdFacts(account.id, adRows),
    availableDataSince,
    availableDataUntil,
    sourceMode: "live",
    fetchedAt: new Date(),
  };
}

export async function getMetaConnectionStatus(): Promise<MetaConnectionStatus> {
  const checkedAt = new Date();

  if (!isMetaApiConfigured()) {
    return {
      configured: false,
      connected: false,
      sourceMode: "demo",
      apiVersion: ENV.metaApiVersion,
      adAccountId: null,
      checkedAt,
      account: null,
      sampleDateStart: null,
      sampleDateStop: null,
      errorMessage: "META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are not configured",
      errorCode: null,
      errorType: null,
      errorSubcode: null,
      fbtraceId: null,
    };
  }

  try {
    const account = await fetchAccountProfile();
    const sample = await fetchGraphJson<GraphPage<MetaInsightRow>>(
      `${normalizeAdAccountId(ENV.metaAdAccountId)}/insights`,
      {
        level: "account",
        date_preset: "last_7d",
        fields: "spend,impressions,clicks,date_start,date_stop",
        limit: "1",
      }
    );
    const sampleRow = sample.data?.[0] ?? null;

    return {
      configured: true,
      connected: true,
      sourceMode: "live",
      apiVersion: ENV.metaApiVersion,
      adAccountId: account.id,
      checkedAt,
      account,
      sampleDateStart: sampleRow?.date_start ?? null,
      sampleDateStop: sampleRow?.date_stop ?? null,
      errorMessage: null,
      errorCode: null,
      errorType: null,
      errorSubcode: null,
      fbtraceId: null,
    };
  } catch (error) {
    const details = getMetaErrorDetails(error);

    return {
      configured: true,
      connected: false,
      sourceMode: "live",
      apiVersion: ENV.metaApiVersion,
      adAccountId: ENV.metaAdAccountId || null,
      checkedAt,
      account: null,
      sampleDateStart: null,
      sampleDateStop: null,
      ...details,
    };
  }
}
