import { desc, eq } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import {
  metaAccounts,
  metaAdDailyFacts,
  metaAds,
  metaAdsetDailyFacts,
  metaAdsets,
  metaCampaignDailyFacts,
  metaCampaigns,
  type MetaAccount,
  type MetaAd,
  type MetaAdDailyFact,
  type MetaAdset,
  type MetaAdsetDailyFact,
  type MetaCampaign,
  type MetaCampaignDailyFact,
} from "../drizzle/schema";
import {
  buildCampaignRecommendation,
  formatReportDateRange,
  getCampaignStatus,
  normalizeObjective,
  type ActionSignalRow,
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

type ExplorerCampaignRow = {
  id: string;
  name: string;
  shortName: string;
  objective: string;
  deliveryStatus: string | null;
  performanceStatus: ReturnType<typeof getCampaignStatus>;
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
};

type ExplorerAdsetRow = {
  id: string;
  campaignId: string;
  name: string;
  deliveryStatus: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  performanceStatus: ReturnType<typeof getCampaignStatus>;
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
};

type ExplorerAdRow = {
  id: string;
  campaignId: string;
  adsetId: string;
  name: string;
  deliveryStatus: string | null;
  creativeId: string | null;
  creativeName: string | null;
  performanceStatus: ReturnType<typeof getCampaignStatus>;
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
};

let memoryStore: ReportingMemoryStore | null = null;

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

function resolveExplorerRange(filters: ExplorerFilters): ExplorerRange {
  const today = isoToday();
  let since = today;
  let until = today;

  switch (filters.preset) {
    case "today":
      since = today;
      until = today;
      break;
    case "yesterday":
      since = format(subDays(new Date(), 1), "yyyy-MM-dd");
      until = since;
      break;
    case "last_7d":
      since = format(subDays(new Date(), 6), "yyyy-MM-dd");
      until = today;
      break;
    case "last_30d":
      since = format(subDays(new Date(), 29), "yyyy-MM-dd");
      until = today;
      break;
    case "last_90d":
      since = format(subDays(new Date(), 89), "yyyy-MM-dd");
      until = today;
      break;
    case "this_week_mon_today": {
      const date = new Date();
      const day = date.getDay();
      const offset = day === 0 ? 6 : day - 1;
      since = format(subDays(date, offset), "yyyy-MM-dd");
      until = today;
      break;
    }
    case "custom":
      since = normalizeDate(filters.since, format(subDays(new Date(), 29), "yyyy-MM-dd"));
      until = normalizeDate(filters.until, today);
      break;
  }

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

  await db.delete(metaAdDailyFacts).where(eq(metaAdDailyFacts.accountId, dataset.account.id));
  await db.delete(metaAdsetDailyFacts).where(eq(metaAdsetDailyFacts.accountId, dataset.account.id));
  await db.delete(metaCampaignDailyFacts).where(eq(metaCampaignDailyFacts.accountId, dataset.account.id));
  await db.delete(metaAds).where(eq(metaAds.accountId, dataset.account.id));
  await db.delete(metaAdsets).where(eq(metaAdsets.accountId, dataset.account.id));
  await db.delete(metaCampaigns).where(eq(metaCampaigns.accountId, dataset.account.id));

  if (dataset.campaigns.length > 0) {
    await db.insert(metaCampaigns).values(dataset.campaigns);
  }
  if (dataset.adsets.length > 0) {
    await db.insert(metaAdsets).values(dataset.adsets);
  }
  if (dataset.ads.length > 0) {
    await db.insert(metaAds).values(dataset.ads);
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
    const name = `${campaign.name} ${campaign.shortName}`.toLowerCase();

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
  dataset: ReportingMemoryStore,
  filters: ExplorerFilters,
  range: ExplorerRange,
  cplTarget: number
): ExplorerCampaignRow[] {
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, filters);
  const eligibleIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const grouped = new Map<string, NormalizedCampaignFact[]>();

  dataset.campaignFacts
    .filter(
      fact => eligibleIds.has(fact.campaignId) && inRange(fact.date, range.since, range.until)
    )
    .forEach(fact => {
      const rows = grouped.get(fact.campaignId) ?? [];
      rows.push(fact);
      grouped.set(fact.campaignId, rows);
    });

  return eligibleCampaigns
    .map(campaign => {
      const metrics = aggregateFacts(grouped.get(campaign.id) ?? []);
      const performanceStatus = getCampaignStatus(metrics.costPerLead, cplTarget);

      return {
        id: campaign.id,
        name: campaign.name,
        shortName: campaign.shortName,
        objective: campaign.objective,
        deliveryStatus: campaign.effectiveStatus ?? campaign.status,
        performanceStatus,
        ...metrics,
        recommendation: buildCampaignRecommendation(
          {
            shortName: campaign.shortName,
            amountSpent: metrics.amountSpent,
            leads: metrics.leads,
            linkClicks: metrics.linkClicks,
            ctrLink: metrics.ctrLink,
            frequency: metrics.frequency,
            costPerLead: metrics.costPerLead,
          },
          cplTarget
        ),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

function buildAdsetRows(
  dataset: ReportingMemoryStore,
  filters: ExplorerFilters,
  range: ExplorerRange,
  campaignId: string,
  cplTarget: number
): ExplorerAdsetRow[] {
  const eligibleCampaigns = filterCampaignEntities(dataset.campaigns, filters);
  const eligibleCampaignIds = new Set(eligibleCampaigns.map(campaign => campaign.id));
  const grouped = new Map<string, NormalizedAdsetFact[]>();

  dataset.adsetFacts
    .filter(
      fact =>
        fact.campaignId === campaignId &&
        eligibleCampaignIds.has(fact.campaignId) &&
        inRange(fact.date, range.since, range.until)
    )
    .forEach(fact => {
      const rows = grouped.get(fact.adsetId) ?? [];
      rows.push(fact);
      grouped.set(fact.adsetId, rows);
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
      const metrics = aggregateFacts(grouped.get(adset.id) ?? []);
      const performanceStatus = getCampaignStatus(metrics.costPerLead, cplTarget);

      return {
        id: adset.id,
        campaignId: adset.campaignId,
        name: adset.name,
        deliveryStatus: adset.effectiveStatus ?? adset.status,
        optimizationGoal: adset.optimizationGoal,
        billingEvent: adset.billingEvent,
        performanceStatus,
        ...metrics,
        recommendation: buildCampaignRecommendation(
          {
            shortName: adset.name,
            amountSpent: metrics.amountSpent,
            leads: metrics.leads,
            linkClicks: metrics.linkClicks,
            ctrLink: metrics.ctrLink,
            frequency: metrics.frequency,
            costPerLead: metrics.costPerLead,
          },
          cplTarget
        ),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

function buildAdRows(
  dataset: ReportingMemoryStore,
  filters: ExplorerFilters,
  range: ExplorerRange,
  adsetId: string,
  cplTarget: number
): ExplorerAdRow[] {
  const grouped = new Map<string, NormalizedAdFact[]>();

  dataset.adFacts
    .filter(fact => fact.adsetId === adsetId && inRange(fact.date, range.since, range.until))
    .forEach(fact => {
      const rows = grouped.get(fact.adId) ?? [];
      rows.push(fact);
      grouped.set(fact.adId, rows);
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
      const metrics = aggregateFacts(grouped.get(ad.id) ?? []);
      const performanceStatus = getCampaignStatus(metrics.costPerLead, cplTarget);

      return {
        id: ad.id,
        campaignId: ad.campaignId,
        adsetId: ad.adsetId,
        name: ad.name,
        deliveryStatus: ad.effectiveStatus ?? ad.status,
        creativeId: ad.creativeId,
        creativeName: ad.creativeName,
        performanceStatus,
        ...metrics,
        recommendation: buildCampaignRecommendation(
          {
            shortName: ad.name,
            amountSpent: metrics.amountSpent,
            leads: metrics.leads,
            linkClicks: metrics.linkClicks,
            ctrLink: metrics.ctrLink,
            frequency: metrics.frequency,
            costPerLead: metrics.costPerLead,
          },
          cplTarget
        ),
      };
    })
    .filter(row => row.amountSpent > 0 || row.leads > 0 || row.impressions > 0)
    .sort((left, right) => right.amountSpent - left.amountSpent);
}

export async function buildAdsetActionSignals(
  filters: ExplorerFilters,
  cplTarget: number
): Promise<ActionSignalRow[]> {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  const range = resolveExplorerRange(filters);

  return dataset.adsets
    .map(adset => {
      const metrics = aggregateFacts(
        dataset.adsetFacts.filter(
          fact => fact.adsetId === adset.id && inRange(fact.date, range.since, range.until)
        )
      );

      return {
        shortName: adset.name,
        amountSpent: metrics.amountSpent,
        ctrLink: metrics.ctrLink,
        frequency: metrics.frequency,
        costPerLead: metrics.costPerLead,
        status: getCampaignStatus(metrics.costPerLead, cplTarget),
      } as ActionSignalRow;
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
      lastUpdatedAt: null as Date | null,
    };
  }

  const range = resolveExplorerRange(filters);
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
      amountSpent:
        previous.amountSpent > 0
          ? Number(
              (((current.amountSpent - previous.amountSpent) / previous.amountSpent) * 100).toFixed(2)
            )
          : null,
      leads:
        previous.leads > 0
          ? Number((((current.leads - previous.leads) / previous.leads) * 100).toFixed(2))
          : null,
      costPerLead:
        previous.costPerLead != null && previous.costPerLead > 0 && current.costPerLead != null
          ? Number(
              (((current.costPerLead - previous.costPerLead) / previous.costPerLead) * 100).toFixed(2)
            )
          : null,
      ctrLink:
        previous.ctrLink > 0
          ? Number((((current.ctrLink - previous.ctrLink) / previous.ctrLink) * 100).toFixed(2))
          : null,
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

  return buildCampaignRows(dataset, filters, resolveExplorerRange(filters), cplTarget);
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
    resolveExplorerRange(filters),
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

  return buildAdRows(dataset, filters, resolveExplorerRange(filters), adsetId, cplTarget);
}

export async function getExplorerTrendSeries(input: ExplorerFilters & {
  level: "account" | "campaign" | "adset" | "ad";
  entityId?: string | null;
}) {
  const dataset = await loadDataset();

  if (!dataset) {
    return [];
  }

  const range = resolveExplorerRange(input);
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
