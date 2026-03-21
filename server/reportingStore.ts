import { desc, eq, sql } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import {
  metaAccounts,
  metaAdDailyFacts,
  metaAds,
  metaAdsetDailyFacts,
  metaAdsets,
  metaCampaignDailyFacts,
  metaCampaigns,
  recommendationItems,
  recommendationRuns,
  type MetaAccount,
  type MetaAd,
  type MetaAdDailyFact,
  type MetaAdset,
  type MetaAdsetDailyFact,
  type MetaCampaign,
  type MetaCampaignDailyFact,
} from "../drizzle/schema";
import {
  formatReportDateRange,
  normalizeObjective,
} from "./dashboardLogic";
import { getDb } from "./db";
import {
  fetchNormalizedReportData,
  type DailyPerformancePoint,
  type FetchedSnapshot,
  type MetaAccountProfile,
  type NormalizedAdEntity,
  type NormalizedAdFact,
  type NormalizedAdsetEntity,
  type NormalizedAdsetFact,
  type NormalizedCampaignEntity,
  type NormalizedCampaignFact,
  type NormalizedMetaDataset,
} from "./metaAdsFetcher";
import {
  buildRecommendationItems,
  computePercentDelta,
  evaluatePerformance,
  parseCampaignIdentity,
  type PerformanceStatus,
  type RecommendationItemDraft,
  type RecommendationSignal,
} from "./reportingAnalysis";

export const EXPLORER_DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_30d",
  "last_90d",
  "this_week_mon_today",
  "custom",
] as const;

export type ExplorerDatePreset = (typeof EXPLORER_DATE_PRESETS)[number];

export type ExplorerFilters = {
  preset: ExplorerDatePreset;
  since?: string | null;
  until?: string | null;
  objective?: string | null;
  status?: string | null;
  query?: string | null;
};

type ReportingMemoryStore = Omit<NormalizedMetaDataset, "fetchedAt" | "sourceMode"> & {
  fetchedAt: Date | null;
  sourceMode: "live" | "demo";
};

type MetricsSummary = {
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
};

type ExplorerRange = {
  preset: ExplorerDatePreset;
  since: string;
  until: string;
  previousSince: string;
  previousUntil: string;
  label: string;
};

type ExplorerDeltaFields = {
  amountSpentDeltaPct: number | null;
  leadsDeltaPct: number | null;
  costPerLeadDeltaPct: number | null;
  ctrLinkDeltaPct: number | null;
};

type ExplorerCampaignRow = {
  id: string;
  name: string;
  shortName: string;
  displayName: string;
  editorCode: string | null;
  campaignDescriptor: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
  objective: string;
  deliveryStatus: string | null;
  performanceStatus: PerformanceStatus;
  performanceScore: number;
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
  recommendation: string;
} & ExplorerDeltaFields;

type ExplorerAdsetRow = {
  id: string;
  campaignId: string;
  name: string;
  campaignDisplayName: string;
  editorCode: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
  deliveryStatus: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  performanceStatus: PerformanceStatus;
  performanceScore: number;
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
  recommendation: string;
} & ExplorerDeltaFields;

type ExplorerAdRow = {
  id: string;
  campaignId: string;
  adsetId: string;
  name: string;
  campaignDisplayName: string;
  editorCode: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
  deliveryStatus: string | null;
  creativeId: string | null;
  creativeName: string | null;
  performanceStatus: PerformanceStatus;
  performanceScore: number;
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
  recommendation: string;
} & ExplorerDeltaFields;

type HomeCampaignRow = ExplorerCampaignRow;

type HomeAccountMetrics = MetricsSummary & {
  reportDateRange: string;
  accountName: string;
  accountCurrency: string;
};

type HomeDashboardView = {
  range: ExplorerRange;
  accountMetrics: HomeAccountMetrics;
  campaigns: HomeCampaignRow[];
  dailyPerformance: DailyPerformancePoint[];
};

let memoryStore: ReportingMemoryStore | null = null;

function resolveCampaignIdentity(campaign: Pick<
  MetaCampaign,
  "name" | "shortName" | "displayName" | "editorCode" | "campaignDescriptor" | "launchLabel" | "audienceDescriptor"
>) {
  const parsed = parseCampaignIdentity(campaign.name);
  const editorCode = campaign.editorCode ?? parsed.editorCode;
  const campaignDescriptor = campaign.campaignDescriptor ?? parsed.campaignDescriptor;
  const launchLabel = campaign.launchLabel ?? parsed.launchLabel;
  const audienceDescriptor = campaign.audienceDescriptor ?? parsed.audienceDescriptor;
  const displayName =
    editorCode && campaignDescriptor
      ? `${editorCode} | ${campaignDescriptor}`
      : campaign.displayName || parsed.displayName || campaign.shortName || campaign.name;

  return {
    editorCode,
    campaignDescriptor,
    launchLabel,
    audienceDescriptor,
    displayName,
  };
}

function isoToday() {
  return format(new Date(), "yyyy-MM-dd");
}

function normalizeDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    return format(parseISO(value), "yyyy-MM-dd");
  } catch {
    return fallback;
  }
}

function buildPresetRange(preset: ExplorerDatePreset) {
  const today = isoToday();
  switch (preset) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const since = format(subDays(new Date(), 1), "yyyy-MM-dd");
      return { since, until: since };
    }
    case "last_7d":
      return { since: format(subDays(new Date(), 6), "yyyy-MM-dd"), until: today };
    case "last_30d":
      return { since: format(subDays(new Date(), 29), "yyyy-MM-dd"), until: today };
    case "last_90d":
      return { since: format(subDays(new Date(), 89), "yyyy-MM-dd"), until: today };
    case "this_week_mon_today": {
      const date = new Date();
      const day = date.getDay();
      const offset = day === 0 ? 6 : day - 1;
      return { since: format(subDays(date, offset), "yyyy-MM-dd"), until: today };
    }
    case "custom":
      return { since: format(subDays(new Date(), 29), "yyyy-MM-dd"), until: today };
  }
}

function clampDate(value: string, minimum: string | null, maximum: string | null) {
  let next = value;
  if (minimum && next < minimum) {
    next = minimum;
  }
  if (maximum && next > maximum) {
    next = maximum;
  }
  return next;
}

function getAvailableDataWindow(dataset: ReportingMemoryStore | NormalizedMetaDataset) {
  if (dataset.availableDataSince && dataset.availableDataUntil) {
    return {
      availableDataSince: dataset.availableDataSince,
      availableDataUntil: dataset.availableDataUntil,
    };
  }

  const dates = dataset.campaignFacts.map(fact => fact.date).sort();
  return {
    availableDataSince: dates[0] ?? null,
    availableDataUntil: dates.at(-1) ?? null,
  };
}

function resolveExplorerRange(
  filters: ExplorerFilters,
  availableWindow?: { availableDataSince: string | null; availableDataUntil: string | null }
): ExplorerRange {
  const presetRange = buildPresetRange(filters.preset);
  const usesExplicitDates = Boolean(filters.since || filters.until);
  let since = usesExplicitDates
    ? normalizeDate(filters.since, presetRange.since)
    : presetRange.since;
  let until = usesExplicitDates
    ? normalizeDate(filters.until, presetRange.until)
    : presetRange.until;

  since = clampDate(
    since,
    availableWindow?.availableDataSince ?? null,
    availableWindow?.availableDataUntil ?? null
  );
  until = clampDate(
    until,
    availableWindow?.availableDataSince ?? null,
    availableWindow?.availableDataUntil ?? null
  );

  if (since > until) {
    const swap = since;
    since = until;
    until = swap;
  }

  const currentStart = parseISO(since);
  const currentEnd = parseISO(until);
  const daySpan =
    Math.max(
      0,
      Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000)
    ) + 1;
  const previousUntil = format(subDays(currentStart, 1), "yyyy-MM-dd");
  const previousSince = format(subDays(currentStart, daySpan), "yyyy-MM-dd");

  return {
    preset: filters.preset,
    since,
    until,
    previousSince,
    previousUntil,
    label: formatReportDateRange(since, until),
  };
}

function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function zeroMetrics(): MetricsSummary {
  return {
    amountSpent: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicksAll: 0,
    linkClicks: 0,
    ctrAll: 0,
    ctrLink: 0,
    cpm: 0,
    cpcAll: 0,
    cpcLink: 0,
    leads: 0,
    costPerLead: null,
  };
}

function finalizeMetrics(input: {
  amountSpent: number;
  impressions: number;
  reach: number;
  clicksAll: number;
  linkClicks: number;
  leads: number;
}): MetricsSummary {
  const frequency = input.reach > 0 ? input.impressions / input.reach : 0;
  const ctrAll =
    input.impressions > 0 ? (input.clicksAll / input.impressions) * 100 : 0;
  const ctrLink =
    input.impressions > 0 ? (input.linkClicks / input.impressions) * 100 : 0;
  const cpm =
    input.impressions > 0 ? (input.amountSpent / input.impressions) * 1000 : 0;
  const cpcAll = input.clicksAll > 0 ? input.amountSpent / input.clicksAll : 0;
  const cpcLink =
    input.linkClicks > 0 ? input.amountSpent / input.linkClicks : 0;
  const costPerLead =
    input.leads > 0 ? Number((input.amountSpent / input.leads).toFixed(4)) : null;

  return {
    amountSpent: Number(input.amountSpent.toFixed(2)),
    impressions: input.impressions,
    reach: input.reach,
    frequency: Number(frequency.toFixed(4)),
    clicksAll: input.clicksAll,
    linkClicks: input.linkClicks,
    ctrAll: Number(ctrAll.toFixed(4)),
    ctrLink: Number(ctrLink.toFixed(4)),
    cpm: Number(cpm.toFixed(4)),
    cpcAll: Number(cpcAll.toFixed(4)),
    cpcLink: Number(cpcLink.toFixed(4)),
    leads: input.leads,
    costPerLead,
  };
}

function aggregateFacts<
  T extends { date: string; amountSpent: number | string; impressions: number; reach: number; clicksAll: number; linkClicks: number; leads: number }
>(facts: T[]) {
  return finalizeMetrics(
    facts.reduce(
      (acc, fact) => {
        acc.amountSpent += toNumber(fact.amountSpent);
        acc.impressions += fact.impressions;
        acc.reach += fact.reach;
        acc.clicksAll += fact.clicksAll;
        acc.linkClicks += fact.linkClicks;
        acc.leads += fact.leads;
        return acc;
      },
      {
        amountSpent: 0,
        impressions: 0,
        reach: 0,
        clicksAll: 0,
        linkClicks: 0,
        leads: 0,
      }
    )
  );
}

function buildDeltaFields(current: MetricsSummary, previous: MetricsSummary): ExplorerDeltaFields {
  return {
    amountSpentDeltaPct: computePercentDelta(current.amountSpent, previous.amountSpent),
    leadsDeltaPct: computePercentDelta(current.leads, previous.leads),
    costPerLeadDeltaPct:
      current.costPerLead != null && previous.costPerLead != null
        ? computePercentDelta(current.costPerLead, previous.costPerLead)
        : null,
    ctrLinkDeltaPct: computePercentDelta(current.ctrLink, previous.ctrLink),
  };
}

function buildRecommendationCopy(input: {
  displayName: string;
  performanceStatus: PerformanceStatus;
  performanceScore: number;
  amountSpent: number;
  leads: number;
  costPerLead: number | null;
  ctrLink: number;
  frequency: number;
  cplTarget: number;
  cplDeltaPct: number | null;
}) {
  if (input.amountSpent >= input.cplTarget * 2 && input.leads === 0) {
    return "Spend is outpacing conversion signal. Pull budget back until a new angle or audience test is ready.";
  }
  if (input.performanceStatus === "excellent") {
    return input.leads >= 15
      ? "Performance is holding well above target. Scale in small steps while watching quality and frequency."
      : "Efficiency is strong. Keep this as a benchmark and feed it better tests instead of heavy changes.";
  }
  if (input.ctrLink < 1.25) {
    return "Click-through efficiency is soft. Refresh the hook and first-screen creative before adding budget.";
  }
  if (input.frequency > 2.8) {
    return "Audience fatigue is building. Rotate creative or widen the audience before CPL drifts higher.";
  }
  if ((input.cplDeltaPct ?? 0) > 15) {
    return "CPL is sliding versus the prior period. Audit delivery, targeting, and landing-page fit before scaling.";
  }
  return `Performance score ${input.performanceScore}/100. Keep spend measured while you isolate the next improvement lever.`;
}

function inRange(date: string, since: string, until: string) {
  return date >= since && date <= until;
}

function mapStoredCampaignFact(row: MetaCampaignDailyFact): NormalizedCampaignFact {
  return {
    accountId: row.accountId,
    campaignId: row.campaignId,
    date: row.date,
    amountSpent: toNumber(row.amountSpent),
    impressions: row.impressions,
    reach: row.reach,
    frequency: toNumber(row.frequency),
    clicksAll: row.clicksAll,
    linkClicks: row.linkClicks,
    ctrAll: toNumber(row.ctrAll),
    ctrLink: toNumber(row.ctrLink),
    cpm: toNumber(row.cpm),
    cpcAll: toNumber(row.cpcAll),
    cpcLink: toNumber(row.cpcLink),
    leads: row.leads,
    costPerLead: row.costPerLead != null ? toNumber(row.costPerLead) : null,
  };
}

function mapStoredAdsetFact(row: MetaAdsetDailyFact): NormalizedAdsetFact {
  return {
    accountId: row.accountId,
    campaignId: row.campaignId,
    adsetId: row.adsetId,
    date: row.date,
    amountSpent: toNumber(row.amountSpent),
    impressions: row.impressions,
    reach: row.reach,
    frequency: toNumber(row.frequency),
    clicksAll: row.clicksAll,
    linkClicks: row.linkClicks,
    ctrAll: toNumber(row.ctrAll),
    ctrLink: toNumber(row.ctrLink),
    cpm: toNumber(row.cpm),
    cpcAll: toNumber(row.cpcAll),
    cpcLink: toNumber(row.cpcLink),
    leads: row.leads,
    costPerLead: row.costPerLead != null ? toNumber(row.costPerLead) : null,
  };
}

function mapStoredAdFact(row: MetaAdDailyFact): NormalizedAdFact {
  return {
    accountId: row.accountId,
    campaignId: row.campaignId,
    adsetId: row.adsetId,
    adId: row.adId,
    date: row.date,
    amountSpent: toNumber(row.amountSpent),
    impressions: row.impressions,
    reach: row.reach,
    frequency: toNumber(row.frequency),
    clicksAll: row.clicksAll,
    linkClicks: row.linkClicks,
    ctrAll: toNumber(row.ctrAll),
    ctrLink: toNumber(row.ctrLink),
    cpm: toNumber(row.cpm),
    cpcAll: toNumber(row.cpcAll),
    cpcLink: toNumber(row.cpcLink),
    leads: row.leads,
    costPerLead: row.costPerLead != null ? toNumber(row.costPerLead) : null,
  };
}

async function getMemoryStore() {
  if (!memoryStore) {
    const dataset = await fetchNormalizedReportData();
    memoryStore = {
      ...dataset,
      fetchedAt: dataset.fetchedAt,
      sourceMode: dataset.sourceMode,
    };
  }

  return memoryStore;
}

async function loadDataset(): Promise<ReportingMemoryStore | null> {
  const db = await getDb();

  if (!db) {
    return getMemoryStore();
  }

  const accountRows = await db
    .select()
    .from(metaAccounts)
    .orderBy(desc(metaAccounts.updatedAt))
    .limit(1);
  const account = accountRows[0];

  if (!account) {
    return null;
  }

  const [campaigns, adsets, ads, campaignFacts, adsetFacts, adFacts] =
    await Promise.all([
      db.select().from(metaCampaigns).where(eq(metaCampaigns.accountId, account.id)),
      db.select().from(metaAdsets).where(eq(metaAdsets.accountId, account.id)),
      db.select().from(metaAds).where(eq(metaAds.accountId, account.id)),
      db
        .select()
        .from(metaCampaignDailyFacts)
        .where(eq(metaCampaignDailyFacts.accountId, account.id)),
      db
        .select()
        .from(metaAdsetDailyFacts)
        .where(eq(metaAdsetDailyFacts.accountId, account.id)),
      db
        .select()
        .from(metaAdDailyFacts)
        .where(eq(metaAdDailyFacts.accountId, account.id)),
    ]);

  return {
    account: {
      id: account.id,
      name: account.name,
      currency: account.currency,
    },
    campaigns: campaigns.map((row: MetaCampaign) => ({
      id: row.id,
      accountId: row.accountId,
      name: row.name,
      shortName: row.shortName,
      displayName: row.displayName,
      editorCode: row.editorCode,
      campaignDescriptor: row.campaignDescriptor,
      launchLabel: row.launchLabel,
      audienceDescriptor: row.audienceDescriptor,
      objective: row.objective,
      status: row.status,
      effectiveStatus: row.effectiveStatus,
    })),
    adsets: adsets.map((row: MetaAdset) => ({
      id: row.id,
      accountId: row.accountId,
      campaignId: row.campaignId,
      name: row.name,
      status: row.status,
      effectiveStatus: row.effectiveStatus,
      optimizationGoal: row.optimizationGoal,
      billingEvent: row.billingEvent,
    })),
    ads: ads.map((row: MetaAd) => ({
      id: row.id,
      accountId: row.accountId,
      campaignId: row.campaignId,
      adsetId: row.adsetId,
      name: row.name,
      status: row.status,
      effectiveStatus: row.effectiveStatus,
      creativeId: row.creativeId,
      creativeName: row.creativeName,
    })),
    campaignFacts: campaignFacts.map(mapStoredCampaignFact),
    adsetFacts: adsetFacts.map(mapStoredAdsetFact),
    adFacts: adFacts.map(mapStoredAdFact),
    availableDataSince: campaignFacts[0]
      ? campaignFacts.reduce(
          (earliest, row) => (row.date < earliest ? row.date : earliest),
          campaignFacts[0].date
        )
      : null,
    availableDataUntil: campaignFacts[0]
      ? campaignFacts.reduce(
          (latest, row) => (row.date > latest ? row.date : latest),
          campaignFacts[0].date
        )
      : null,
    fetchedAt: account.updatedAt,
    sourceMode: "live",
  };
}

export async function persistNormalizedReportData(dataset: NormalizedMetaDataset) {
  const db = await getDb();

  if (!db) {
    memoryStore = {
      ...dataset,
      fetchedAt: dataset.fetchedAt,
      sourceMode: dataset.sourceMode,
    };
    return;
  }

  await db.insert(metaAccounts).values({
    id: dataset.account.id,
    name: dataset.account.name,
    currency: dataset.account.currency,
  }).onDuplicateKeyUpdate({
    set: {
      name: dataset.account.name,
      currency: dataset.account.currency,
      updatedAt: new Date(),
    },
  });

  await db.delete(metaAds).where(eq(metaAds.accountId, dataset.account.id));
  await db.delete(metaAdsets).where(eq(metaAdsets.accountId, dataset.account.id));
  await db.delete(metaCampaigns).where(eq(metaCampaigns.accountId, dataset.account.id));

  if (dataset.campaigns.length > 0) {
    await db.insert(metaCampaigns).values(dataset.campaigns.map(campaign => ({
      ...campaign,
      displayName: campaign.displayName,
      editorCode: campaign.editorCode,
      campaignDescriptor: campaign.campaignDescriptor,
      launchLabel: campaign.launchLabel,
      audienceDescriptor: campaign.audienceDescriptor,
    })));
  }
  if (dataset.adsets.length > 0) {
    await db.insert(metaAdsets).values(dataset.adsets);
  }
  if (dataset.ads.length > 0) {
    await db.insert(metaAds).values(dataset.ads);
  }
  const factWindowSince = dataset.availableDataSince;
  const factWindowUntil = dataset.availableDataUntil;

  if (factWindowSince && factWindowUntil) {
    await db
      .delete(metaAdDailyFacts)
      .where(
        sql`${metaAdDailyFacts.accountId} = ${dataset.account.id} and ${metaAdDailyFacts.date} >= ${factWindowSince} and ${metaAdDailyFacts.date} <= ${factWindowUntil}`
      );
    await db
      .delete(metaAdsetDailyFacts)
      .where(
        sql`${metaAdsetDailyFacts.accountId} = ${dataset.account.id} and ${metaAdsetDailyFacts.date} >= ${factWindowSince} and ${metaAdsetDailyFacts.date} <= ${factWindowUntil}`
      );
    await db
      .delete(metaCampaignDailyFacts)
      .where(
        sql`${metaCampaignDailyFacts.accountId} = ${dataset.account.id} and ${metaCampaignDailyFacts.date} >= ${factWindowSince} and ${metaCampaignDailyFacts.date} <= ${factWindowUntil}`
      );
  }

  if (dataset.campaignFacts.length > 0) {
    await db.insert(metaCampaignDailyFacts).values(
      dataset.campaignFacts.map(fact => ({
        accountId: fact.accountId,
        campaignId: fact.campaignId,
        date: fact.date,
        amountSpent: fact.amountSpent.toFixed(2),
        impressions: fact.impressions,
        reach: fact.reach,
        frequency: fact.frequency.toFixed(4),
        clicksAll: fact.clicksAll,
        linkClicks: fact.linkClicks,
        ctrAll: fact.ctrAll.toFixed(4),
        ctrLink: fact.ctrLink.toFixed(4),
        cpm: fact.cpm.toFixed(4),
        cpcAll: fact.cpcAll.toFixed(4),
        cpcLink: fact.cpcLink.toFixed(4),
        leads: fact.leads,
        costPerLead:
          fact.costPerLead != null ? fact.costPerLead.toFixed(4) : null,
      }))
    );
  }
  if (dataset.adsetFacts.length > 0) {
    await db.insert(metaAdsetDailyFacts).values(
      dataset.adsetFacts.map(fact => ({
        accountId: fact.accountId,
        campaignId: fact.campaignId,
        adsetId: fact.adsetId,
        date: fact.date,
        amountSpent: fact.amountSpent.toFixed(2),
        impressions: fact.impressions,
        reach: fact.reach,
        frequency: fact.frequency.toFixed(4),
        clicksAll: fact.clicksAll,
        linkClicks: fact.linkClicks,
        ctrAll: fact.ctrAll.toFixed(4),
        ctrLink: fact.ctrLink.toFixed(4),
        cpm: fact.cpm.toFixed(4),
        cpcAll: fact.cpcAll.toFixed(4),
        cpcLink: fact.cpcLink.toFixed(4),
        leads: fact.leads,
        costPerLead:
          fact.costPerLead != null ? fact.costPerLead.toFixed(4) : null,
      }))
    );
  }
  if (dataset.adFacts.length > 0) {
    await db.insert(metaAdDailyFacts).values(
      dataset.adFacts.map(fact => ({
        accountId: fact.accountId,
        campaignId: fact.campaignId,
        adsetId: fact.adsetId,
        adId: fact.adId,
        date: fact.date,
        amountSpent: fact.amountSpent.toFixed(2),
        impressions: fact.impressions,
        reach: fact.reach,
        frequency: fact.frequency.toFixed(4),
        clicksAll: fact.clicksAll,
        linkClicks: fact.linkClicks,
        ctrAll: fact.ctrAll.toFixed(4),
        ctrLink: fact.ctrLink.toFixed(4),
        cpm: fact.cpm.toFixed(4),
        cpcAll: fact.cpcAll.toFixed(4),
        cpcLink: fact.cpcLink.toFixed(4),
        leads: fact.leads,
        costPerLead:
          fact.costPerLead != null ? fact.costPerLead.toFixed(4) : null,
      }))
    );
  }
}

function filterCampaignEntities(
  campaigns: NormalizedCampaignEntity[],
  filters: ExplorerFilters
) {
  const objective = filters.objective?.trim().toLowerCase();
  const status = filters.status?.trim().toLowerCase();
  const query = filters.query?.trim().toLowerCase();

  return campaigns.filter(campaign => {
    const deliveryStatus = (
      campaign.effectiveStatus ??
      campaign.status ??
      ""
    ).toLowerCase();
    const name = [
      campaign.name,
      campaign.shortName,
      campaign.displayName,
      campaign.editorCode,
      campaign.campaignDescriptor,
      campaign.launchLabel,
      campaign.audienceDescriptor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (objective && campaign.objective.toLowerCase() !== objective) {
      return false;
    }
    if (status && deliveryStatus !== status) {
      return false;
    }
    if (query && !name.includes(query)) {
      return false;
    }
    return true;
  });
}

function buildCampaignRows(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  filters: ExplorerFilters,
  range: ExplorerRange,
  cplTarget: number
): ExplorerCampaignRow[] {
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, filters);
  const eligibleIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const groupedCurrent = new Map<string, NormalizedCampaignFact[]>();
  const groupedPrevious = new Map<string, NormalizedCampaignFact[]>();

  dataset.campaignFacts
    .filter(fact => eligibleIds.has(fact.campaignId))
    .forEach(fact => {
      if (inRange(fact.date, range.since, range.until)) {
        const rows = groupedCurrent.get(fact.campaignId) ?? [];
        rows.push(fact);
        groupedCurrent.set(fact.campaignId, rows);
      } else if (inRange(fact.date, range.previousSince, range.previousUntil)) {
        const rows = groupedPrevious.get(fact.campaignId) ?? [];
        rows.push(fact);
        groupedPrevious.set(fact.campaignId, rows);
      }
    });

  return eligibleCampaigns
    .map(campaign => {
      const identity = resolveCampaignIdentity(campaign);
      const metrics = aggregateFacts(groupedCurrent.get(campaign.id) ?? []);
      const previousMetrics = aggregateFacts(groupedPrevious.get(campaign.id) ?? []);
      const evaluation = evaluatePerformance({
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        priorCostPerLead: previousMetrics.costPerLead,
        cplTarget,
      });

      return {
        id: campaign.id,
        name: campaign.name,
        shortName: campaign.shortName,
        displayName: identity.displayName,
        editorCode: identity.editorCode,
        campaignDescriptor: identity.campaignDescriptor,
        launchLabel: identity.launchLabel,
        audienceDescriptor: identity.audienceDescriptor,
        objective: campaign.objective,
        deliveryStatus: campaign.effectiveStatus ?? campaign.status,
        performanceStatus: evaluation.performanceStatus,
        performanceScore: evaluation.performanceScore,
        ...metrics,
        ...buildDeltaFields(metrics, previousMetrics),
        recommendation: buildRecommendationCopy({
          displayName: identity.displayName,
          performanceStatus: evaluation.performanceStatus,
          performanceScore: evaluation.performanceScore,
          amountSpent: metrics.amountSpent,
          leads: metrics.leads,
          costPerLead: metrics.costPerLead,
          ctrLink: metrics.ctrLink,
          frequency: metrics.frequency,
          cplTarget,
          cplDeltaPct: evaluation.cplDeltaPct,
        }),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

function buildAdsetRows(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  filters: ExplorerFilters,
  range: ExplorerRange,
  campaignId: string,
  cplTarget: number
): ExplorerAdsetRow[] {
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, filters);
  const eligibleCampaignIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const campaignMap = new Map(dataset.campaigns.map(campaign => [campaign.id, campaign]));
  const groupedCurrent = new Map<string, NormalizedAdsetFact[]>();
  const groupedPrevious = new Map<string, NormalizedAdsetFact[]>();

  dataset.adsetFacts
    .filter(fact => fact.campaignId === campaignId && eligibleCampaignIds.has(fact.campaignId))
    .forEach(fact => {
      if (inRange(fact.date, range.since, range.until)) {
        const rows = groupedCurrent.get(fact.adsetId) ?? [];
        rows.push(fact);
        groupedCurrent.set(fact.adsetId, rows);
      } else if (inRange(fact.date, range.previousSince, range.previousUntil)) {
        const rows = groupedPrevious.get(fact.adsetId) ?? [];
        rows.push(fact);
        groupedPrevious.set(fact.adsetId, rows);
      }
    });

  return dataset.adsets
    .filter(adset => adset.campaignId === campaignId)
    .filter(adset => {
      const status = filters.status?.trim().toLowerCase();
      const query = filters.query?.trim().toLowerCase();
      const deliveryStatus = (adset.effectiveStatus ?? adset.status ?? "").toLowerCase();

      if (status && deliveryStatus !== status) {
        return false;
      }
      if (query && !adset.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    })
    .map(adset => {
      const metrics = aggregateFacts(groupedCurrent.get(adset.id) ?? []);
      const previousMetrics = aggregateFacts(groupedPrevious.get(adset.id) ?? []);
      const evaluation = evaluatePerformance({
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        priorCostPerLead: previousMetrics.costPerLead,
        cplTarget,
      });
      const campaign = campaignMap.get(adset.campaignId);
      const identity = campaign ? resolveCampaignIdentity(campaign) : null;

      return {
        id: adset.id,
        campaignId: adset.campaignId,
        name: adset.name,
        campaignDisplayName: identity?.displayName ?? campaign?.shortName ?? adset.name,
        editorCode: identity?.editorCode ?? null,
        launchLabel: identity?.launchLabel ?? null,
        audienceDescriptor: identity?.audienceDescriptor ?? null,
        deliveryStatus: adset.effectiveStatus ?? adset.status,
        optimizationGoal: adset.optimizationGoal,
        billingEvent: adset.billingEvent,
        performanceStatus: evaluation.performanceStatus,
        performanceScore: evaluation.performanceScore,
        ...metrics,
        ...buildDeltaFields(metrics, previousMetrics),
        recommendation: buildRecommendationCopy({
          displayName: adset.name,
          performanceStatus: evaluation.performanceStatus,
          performanceScore: evaluation.performanceScore,
          amountSpent: metrics.amountSpent,
          leads: metrics.leads,
          costPerLead: metrics.costPerLead,
          ctrLink: metrics.ctrLink,
          frequency: metrics.frequency,
          cplTarget,
          cplDeltaPct: evaluation.cplDeltaPct,
        }),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

function buildAdRows(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  filters: ExplorerFilters,
  range: ExplorerRange,
  adsetId: string,
  cplTarget: number
): ExplorerAdRow[] {
  const groupedCurrent = new Map<string, NormalizedAdFact[]>();
  const groupedPrevious = new Map<string, NormalizedAdFact[]>();
  const adsetMap = new Map(dataset.adsets.map(adset => [adset.id, adset]));
  const campaignMap = new Map(dataset.campaigns.map(campaign => [campaign.id, campaign]));

  dataset.adFacts
    .filter(fact => fact.adsetId === adsetId)
    .forEach(fact => {
      if (inRange(fact.date, range.since, range.until)) {
        const rows = groupedCurrent.get(fact.adId) ?? [];
        rows.push(fact);
        groupedCurrent.set(fact.adId, rows);
      } else if (inRange(fact.date, range.previousSince, range.previousUntil)) {
        const rows = groupedPrevious.get(fact.adId) ?? [];
        rows.push(fact);
        groupedPrevious.set(fact.adId, rows);
      }
    });

  return dataset.ads
    .filter(ad => ad.adsetId === adsetId)
    .filter(ad => {
      const status = filters.status?.trim().toLowerCase();
      const query = filters.query?.trim().toLowerCase();
      const deliveryStatus = (ad.effectiveStatus ?? ad.status ?? "").toLowerCase();

      if (status && deliveryStatus !== status) {
        return false;
      }
      if (query && !ad.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    })
    .map(ad => {
      const metrics = aggregateFacts(groupedCurrent.get(ad.id) ?? []);
      const previousMetrics = aggregateFacts(groupedPrevious.get(ad.id) ?? []);
      const evaluation = evaluatePerformance({
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        priorCostPerLead: previousMetrics.costPerLead,
        cplTarget,
      });
      const adset = adsetMap.get(ad.adsetId);
      const campaign = campaignMap.get(ad.campaignId);
      const identity = campaign ? resolveCampaignIdentity(campaign) : null;

      return {
        id: ad.id,
        campaignId: ad.campaignId,
        adsetId: ad.adsetId,
        name: ad.name,
        campaignDisplayName:
          identity?.displayName ?? adset?.name ?? campaign?.shortName ?? ad.name,
        editorCode: identity?.editorCode ?? null,
        launchLabel: identity?.launchLabel ?? null,
        audienceDescriptor: identity?.audienceDescriptor ?? null,
        deliveryStatus: ad.effectiveStatus ?? ad.status,
        creativeId: ad.creativeId,
        creativeName: ad.creativeName,
        performanceStatus: evaluation.performanceStatus,
        performanceScore: evaluation.performanceScore,
        ...metrics,
        ...buildDeltaFields(metrics, previousMetrics),
        recommendation: buildRecommendationCopy({
          displayName: ad.name,
          performanceStatus: evaluation.performanceStatus,
          performanceScore: evaluation.performanceScore,
          amountSpent: metrics.amountSpent,
          leads: metrics.leads,
          costPerLead: metrics.costPerLead,
          ctrLink: metrics.ctrLink,
          frequency: metrics.frequency,
          cplTarget,
          cplDeltaPct: evaluation.cplDeltaPct,
        }),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

export async function buildAdsetActionSignals(
  filters: ExplorerFilters,
  cplTarget: number
): Promise<RecommendationSignal[]> {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  const range = resolveExplorerRange(filters, getAvailableDataWindow(dataset));
  const campaignMap = new Map(dataset.campaigns.map(campaign => [campaign.id, campaign]));

  return dataset.adsets
    .map(adset => {
      const metrics = aggregateFacts(
        dataset.adsetFacts.filter(
          fact => fact.adsetId === adset.id && inRange(fact.date, range.since, range.until)
        )
      );
      const previousMetrics = aggregateFacts(
        dataset.adsetFacts.filter(
          fact =>
            fact.adsetId === adset.id &&
            inRange(fact.date, range.previousSince, range.previousUntil)
        )
      );
      const evaluation = evaluatePerformance({
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        priorCostPerLead: previousMetrics.costPerLead,
        cplTarget,
      });
      const campaign = campaignMap.get(adset.campaignId);

      return {
        entityLevel: "adset" as const,
        entityId: adset.id,
        displayName: adset.name,
        editorCode: campaign?.editorCode ?? null,
        launchLabel: campaign?.launchLabel ?? null,
        audienceDescriptor: campaign?.audienceDescriptor ?? null,
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        priorCostPerLead: previousMetrics.costPerLead,
        cplDeltaPct: evaluation.cplDeltaPct,
        performanceScore: evaluation.performanceScore,
        performanceStatus: evaluation.performanceStatus,
        cplTarget,
      } satisfies RecommendationSignal;
    })
    .filter(signal => Number(signal.amountSpent) > 0 || Number(signal.ctrLink) > 0);
}

export async function getExplorerSummary(filters: ExplorerFilters) {
  const dataset = await loadDataset();

  if (!dataset) {
    const empty = zeroMetrics();
    const range = resolveExplorerRange(filters);
    return {
      account: null,
      range,
      current: empty,
      previous: empty,
      deltas: {
        amountSpent: null,
        leads: null,
        costPerLead: null,
        ctrLink: null,
      },
      counts: {
        campaigns: 0,
        adsets: 0,
        ads: 0,
      },
      availableObjectives: [] as string[],
      availableStatuses: [] as string[],
      availableDataSince: null as string | null,
      availableDataUntil: null as string | null,
      lastUpdatedAt: null as Date | null,
    };
  }

  const availableWindow = getAvailableDataWindow(dataset);
  const range = resolveExplorerRange(filters, availableWindow);
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, filters);
  const eligibleIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const currentFacts = dataset.campaignFacts.filter(
    fact => eligibleIds.has(fact.campaignId) && inRange(fact.date, range.since, range.until)
  );
  const previousFacts = dataset.campaignFacts.filter(
    fact =>
      eligibleIds.has(fact.campaignId) &&
      inRange(fact.date, range.previousSince, range.previousUntil)
  );
  const current = aggregateFacts(currentFacts);
  const previous = aggregateFacts(previousFacts);
  const eligibleAdsets = dataset.adsets.filter(adset =>
    eligibleIds.has(adset.campaignId)
  );
  const eligibleAds = dataset.ads.filter(ad => eligibleIds.has(ad.campaignId));

  return {
    account: dataset.account,
    range,
    current,
    previous,
    deltas: {
      amountSpent: computePercentDelta(current.amountSpent, previous.amountSpent),
      leads: computePercentDelta(current.leads, previous.leads),
      costPerLead:
        current.costPerLead != null && previous.costPerLead != null
          ? computePercentDelta(current.costPerLead, previous.costPerLead)
          : null,
      ctrLink: computePercentDelta(current.ctrLink, previous.ctrLink),
    },
    counts: {
      campaigns: eligibleCampaigns.length,
      adsets: eligibleAdsets.length,
      ads: eligibleAds.length,
    },
    availableObjectives: Array.from(
      new Set(dataset.campaigns.map(campaign => normalizeObjective(campaign.objective)))
    ).sort(),
    availableStatuses: Array.from(
      new Set(
        dataset.campaigns
          .map(campaign => campaign.effectiveStatus ?? campaign.status)
          .filter((value): value is string => Boolean(value))
      )
    ).sort(),
    availableDataSince: availableWindow.availableDataSince,
    availableDataUntil: availableWindow.availableDataUntil,
    lastUpdatedAt: dataset.fetchedAt,
  };
}

export async function getExplorerCampaignBreakdown(
  filters: ExplorerFilters,
  cplTarget: number
) {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  return buildCampaignRows(
    dataset,
    filters,
    resolveExplorerRange(filters, getAvailableDataWindow(dataset)),
    cplTarget
  );
}

export async function getExplorerAdsetBreakdown(
  filters: ExplorerFilters,
  campaignId: string,
  cplTarget: number
) {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  return buildAdsetRows(
    dataset,
    filters,
    resolveExplorerRange(filters, getAvailableDataWindow(dataset)),
    campaignId,
    cplTarget
  );
}

export async function getExplorerAdBreakdown(
  filters: ExplorerFilters,
  adsetId: string,
  cplTarget: number
) {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  return buildAdRows(
    dataset,
    filters,
    resolveExplorerRange(filters, getAvailableDataWindow(dataset)),
    adsetId,
    cplTarget
  );
}

export async function getExplorerTrendSeries(input: ExplorerFilters & {
  level: "account" | "campaign" | "adset" | "ad";
  entityId?: string | null;
}) {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  const range = resolveExplorerRange(input, getAvailableDataWindow(dataset));
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, input);
  const eligibleCampaignIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const grouped = new Map<string, MetricsSummary>();
  const facts =
    input.level === "campaign"
      ? dataset.campaignFacts.filter(
          fact =>
            fact.campaignId === input.entityId && inRange(fact.date, range.since, range.until)
        )
      : input.level === "adset"
        ? dataset.adsetFacts.filter(
            fact =>
              fact.adsetId === input.entityId && inRange(fact.date, range.since, range.until)
          )
        : input.level === "ad"
          ? dataset.adFacts.filter(
              fact => fact.adId === input.entityId && inRange(fact.date, range.since, range.until)
            )
          : dataset.campaignFacts.filter(
              fact =>
                eligibleCampaignIds.has(fact.campaignId) &&
                inRange(fact.date, range.since, range.until)
            );

  facts.forEach(fact => {
    const date = fact.date;
    const rows = grouped.get(date) ?? zeroMetrics();
    const next = aggregateFacts([
      {
        date,
        amountSpent: rows.amountSpent,
        impressions: rows.impressions,
        reach: rows.reach,
        clicksAll: rows.clicksAll,
        linkClicks: rows.linkClicks,
        leads: rows.leads,
      },
      fact,
    ]);
    grouped.set(date, next);
  });

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, metrics]) => ({
      date,
      label: format(parseISO(date), "MMM d"),
      ...metrics,
    }));
}

function buildDailyPerformanceSeries(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  range: ExplorerRange
) {
  const grouped = new Map<string, NormalizedCampaignFact[]>();

  dataset.campaignFacts
    .filter(fact => inRange(fact.date, range.since, range.until))
    .forEach(fact => {
      const rows = grouped.get(fact.date) ?? [];
      rows.push(fact);
      grouped.set(fact.date, rows);
    });

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, facts]) => {
      const metrics = aggregateFacts(facts);

      return {
        date,
        label: format(parseISO(date), "MMM d"),
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        costPerLead: metrics.costPerLead,
      } satisfies DailyPerformancePoint;
    });
}

export function buildHomeDashboardViewFromDataset(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  cplTarget: number
): HomeDashboardView {
  const availableWindow = getAvailableDataWindow(dataset);
  const range = resolveExplorerRange(
    {
      preset: "last_30d",
      since: null,
      until: null,
      objective: null,
      status: null,
      query: null,
    },
    availableWindow
  );
  const groupedCurrentFacts = dataset.campaignFacts.filter(fact =>
    inRange(fact.date, range.since, range.until)
  );
  const current = aggregateFacts(groupedCurrentFacts);

  return {
    range,
    accountMetrics: {
      reportDateRange: range.label,
      accountName: dataset.account.name,
      accountCurrency: dataset.account.currency,
      ...current,
    },
    campaigns: buildCampaignRows(
      dataset,
      {
        preset: "last_30d",
        since: range.since,
        until: range.until,
        objective: null,
        status: null,
        query: null,
      },
      range,
      cplTarget
    ),
    dailyPerformance: buildDailyPerformanceSeries(dataset, range),
  };
}

export async function getHomeDashboardView(cplTarget: number) {
  const dataset = await loadDataset();

  if (!dataset) {
    const range = resolveExplorerRange({
      preset: "last_30d",
      since: null,
      until: null,
      objective: null,
      status: null,
      query: null,
    });
    return {
      range,
      accountMetrics: {
        reportDateRange: range.label,
        accountName: "Meta Ad Account",
        accountCurrency: "USD",
        ...zeroMetrics(),
      },
      campaigns: [] as HomeCampaignRow[],
      dailyPerformance: [] as DailyPerformancePoint[],
    };
  }

  return buildHomeDashboardViewFromDataset(dataset, cplTarget);
}

export function buildRecommendationItemsFromDataset(
  dataset: ReportingMemoryStore | NormalizedMetaDataset,
  cplTarget: number
) {
  const homeView = buildHomeDashboardViewFromDataset(dataset, cplTarget);
  const campaignSignals: RecommendationSignal[] = homeView.campaigns.map(row => ({
    entityLevel: "campaign",
    entityId: row.id,
    displayName: row.displayName,
    editorCode: row.editorCode,
    launchLabel: row.launchLabel,
    audienceDescriptor: row.audienceDescriptor,
    amountSpent: row.amountSpent,
    leads: row.leads,
    ctrLink: row.ctrLink,
    frequency: row.frequency,
    costPerLead: row.costPerLead,
    priorCostPerLead:
      row.costPerLead != null && row.costPerLeadDeltaPct != null
        ? Number((row.costPerLead / (1 + row.costPerLeadDeltaPct / 100)).toFixed(4))
        : null,
    cplDeltaPct: row.costPerLeadDeltaPct,
    performanceScore: row.performanceScore,
    performanceStatus: row.performanceStatus,
    cplTarget,
  }));

  const adsetSignals = dataset.campaigns.flatMap(campaign =>
    buildAdsetRows(
      dataset,
      {
        preset: "last_30d",
        since: homeView.range.since,
        until: homeView.range.until,
        objective: null,
        status: null,
        query: null,
      },
      homeView.range,
      campaign.id,
      cplTarget
    ).map(row => ({
      entityLevel: "adset" as const,
      entityId: row.id,
      displayName: row.name,
      editorCode: row.editorCode,
      launchLabel: row.launchLabel,
      audienceDescriptor: row.audienceDescriptor,
      amountSpent: row.amountSpent,
      leads: row.leads,
      ctrLink: row.ctrLink,
      frequency: row.frequency,
      costPerLead: row.costPerLead,
      priorCostPerLead:
        row.costPerLead != null && row.costPerLeadDeltaPct != null
          ? Number((row.costPerLead / (1 + row.costPerLeadDeltaPct / 100)).toFixed(4))
          : null,
      cplDeltaPct: row.costPerLeadDeltaPct,
      performanceScore: row.performanceScore,
      performanceStatus: row.performanceStatus,
      cplTarget,
    }))
  );

  return buildRecommendationItems([...campaignSignals, ...adsetSignals]);
}

export async function persistRecommendationRun(input: {
  accountId: string;
  since: string;
  until: string;
  sourceMode: "live" | "demo";
  items: RecommendationItemDraft[];
}) {
  const db = await getDb();

  if (!db) {
    return null;
  }

  const [insertResult] = await db.insert(recommendationRuns).values({
    accountId: input.accountId,
    dateRangeSince: input.since,
    dateRangeUntil: input.until,
    sourceMode: input.sourceMode,
  });
  const runId = (insertResult as { insertId: number }).insertId;

  if (input.items.length > 0) {
    await db.insert(recommendationItems).values(
      input.items.map(item => ({
        runId,
        entityLevel: item.entityLevel,
        entityId: item.entityId,
        actionType: item.actionType,
        headline: item.headline,
        rationale: item.rationale,
        confidenceScore: item.confidenceScore.toFixed(2),
        expectedImpact: item.expectedImpact,
        riskNote: item.riskNote,
        status: item.status,
      }))
    );
  }

  return runId;
}

export async function buildLegacySnapshotFromNormalizedData(input: {
  dataset: NormalizedMetaDataset;
  preset: string;
  label: string;
  isPartial: boolean;
  since: string;
  until: string;
}): Promise<FetchedSnapshot> {
  const grouped = new Map<string, NormalizedCampaignFact[]>();

  input.dataset.campaignFacts
    .filter(fact => inRange(fact.date, input.since, input.until))
    .forEach(fact => {
      const rows = grouped.get(fact.campaignId) ?? [];
      rows.push(fact);
      grouped.set(fact.campaignId, rows);
    });

  const campaigns = input.dataset.campaigns
    .map(campaign => {
      const metrics = aggregateFacts(grouped.get(campaign.id) ?? []);

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        shortName: campaign.shortName,
        objective: campaign.objective,
        status: "moderate" as const,
        ...metrics,
      };
    })
    .filter(campaign => campaign.amountSpent > 0 || campaign.leads > 0 || campaign.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
  const accountMetrics = aggregateFacts(
    input.dataset.campaignFacts.filter(fact => inRange(fact.date, input.since, input.until))
  );

  return {
    datePreset: input.preset,
    datePresetLabel: input.label,
    dateRangeSince: input.since,
    dateRangeUntil: input.until,
    isPartial: input.isPartial,
    account: {
      ...accountMetrics,
      costPerLead: accountMetrics.costPerLead ?? 0,
    },
    campaigns,
  };
}

export async function buildLegacyDailyPerformanceFromNormalizedData(input: {
  dataset: NormalizedMetaDataset;
  since: string;
  until: string;
}) {
  const grouped = new Map<string, NormalizedCampaignFact[]>();

  input.dataset.campaignFacts
    .filter(fact => inRange(fact.date, input.since, input.until))
    .forEach(fact => {
      const rows = grouped.get(fact.date) ?? [];
      rows.push(fact);
      grouped.set(fact.date, rows);
    });

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, facts]) => {
      const metrics = aggregateFacts(facts);

      return {
        date,
        label: format(parseISO(date), "MMM d"),
        amountSpent: metrics.amountSpent,
        leads: metrics.leads,
        costPerLead: metrics.costPerLead,
      } satisfies DailyPerformancePoint;
    });
}
