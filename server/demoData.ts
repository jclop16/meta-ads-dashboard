import {
  eachDayOfInterval,
  format,
  startOfWeek,
  subDays,
} from "date-fns";
import type {
  DailyPerformancePoint,
  FetchedSnapshot,
  MetaAccountProfile,
} from "./metaAdsFetcher";

const BASE_CAMPAIGNS: FetchedSnapshot["campaigns"] = [
  {
    campaignId: "6976841592619",
    campaignName: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 1",
    shortName: "FEGLI Trap — Hook 1",
    objective: "FEGLI Trap",
    status: "moderate",
    amountSpent: 3614.9,
    impressions: 99646,
    reach: 57756,
    frequency: 1.73,
    clicksAll: 4330,
    linkClicks: 2640,
    ctrAll: 4.35,
    ctrLink: 2.65,
    cpm: 36.28,
    cpcAll: 0.83,
    cpcLink: 1.37,
    leads: 162,
    costPerLead: 22.31,
  },
  {
    campaignId: "6976841592620",
    campaignName: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 2",
    shortName: "FEGLI Trap — Hook 2",
    objective: "FEGLI Trap",
    status: "moderate",
    amountSpent: 2881.3,
    impressions: 77697,
    reach: 46821,
    frequency: 1.56,
    clicksAll: 2931,
    linkClicks: 1776,
    ctrAll: 3.77,
    ctrLink: 2.29,
    cpm: 37.08,
    cpcAll: 0.98,
    cpcLink: 1.62,
    leads: 132,
    costPerLead: 21.83,
  },
  {
    campaignId: "6991305311219",
    campaignName: "DS | Annuity | Leads | CBO | FB | Oct 2025 | Finish Line [SAC]",
    shortName: "Annuity — Finish Line [SAC]",
    objective: "Annuity",
    status: "poor",
    amountSpent: 1791.86,
    impressions: 49228,
    reach: 32702,
    frequency: 1.51,
    clicksAll: 2987,
    linkClicks: 1185,
    ctrAll: 6.07,
    ctrLink: 2.41,
    cpm: 36.4,
    cpcAll: 0.6,
    cpcLink: 1.51,
    leads: 24,
    costPerLead: 74.66,
  },
  {
    campaignId: "6976841592621",
    campaignName: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 3",
    shortName: "FEGLI Trap — Hook 3",
    objective: "FEGLI Trap",
    status: "moderate",
    amountSpent: 1853.76,
    impressions: 51657,
    reach: 36597,
    frequency: 1.41,
    clicksAll: 1717,
    linkClicks: 1066,
    ctrAll: 3.32,
    ctrLink: 2.06,
    cpm: 35.89,
    cpcAll: 1.08,
    cpcLink: 1.74,
    leads: 70,
    costPerLead: 26.48,
  },
  {
    campaignId: "6917542246619",
    campaignName: "DS | Annuity | Leads | CBO | FB | Oct 2025 - 2",
    shortName: "Annuity — Oct 2025 #2",
    objective: "Annuity",
    status: "excellent",
    amountSpent: 1366.1,
    impressions: 39240,
    reach: 30900,
    frequency: 1.27,
    clicksAll: 3270,
    linkClicks: 1550,
    ctrAll: 8.33,
    ctrLink: 3.95,
    cpm: 34.81,
    cpcAll: 0.42,
    cpcLink: 0.88,
    leads: 105,
    costPerLead: 13.01,
  },
  {
    campaignId: "6917545840019",
    campaignName: "DS | Annuity | Leads | CBO | FB | Oct 2025 - 2 [SAC]",
    shortName: "Annuity — Oct 2025 #2 [SAC]",
    objective: "Annuity",
    status: "excellent",
    amountSpent: 1293.79,
    impressions: 30446,
    reach: 21144,
    frequency: 1.44,
    clicksAll: 2429,
    linkClicks: 1031,
    ctrAll: 7.98,
    ctrLink: 3.39,
    cpm: 42.49,
    cpcAll: 0.53,
    cpcLink: 1.25,
    leads: 73,
    costPerLead: 17.72,
  },
  {
    campaignId: "6812512881019",
    campaignName: "DS | Annuity | Leads | CBO | FB | May 2025 - 1",
    shortName: "Annuity — May 2025 #1",
    objective: "Annuity",
    status: "excellent",
    amountSpent: 876.38,
    impressions: 24435,
    reach: 17930,
    frequency: 1.36,
    clicksAll: 1627,
    linkClicks: 443,
    ctrAll: 6.66,
    ctrLink: 1.81,
    cpm: 35.87,
    cpcAll: 0.54,
    cpcLink: 1.98,
    leads: 61,
    costPerLead: 14.37,
  },
  {
    campaignId: "6991332151819",
    campaignName: "DS | Annuity | Leads | CBO | FB | May 2025 | Legacy [SAC]",
    shortName: "Annuity — May 2025 Legacy [SAC]",
    objective: "Annuity",
    status: "moderate",
    amountSpent: 596.77,
    impressions: 18629,
    reach: 13343,
    frequency: 1.4,
    clicksAll: 1030,
    linkClicks: 272,
    ctrAll: 5.53,
    ctrLink: 1.46,
    cpm: 32.03,
    cpcAll: 0.58,
    cpcLink: 2.19,
    leads: 21,
    costPerLead: 28.42,
  },
  {
    campaignId: "6322238560419",
    campaignName: "[Conversion] FEGLI",
    shortName: "[Conv] FEGLI",
    objective: "FEGLI Conversion",
    status: "poor",
    amountSpent: 372.51,
    impressions: 5795,
    reach: 4394,
    frequency: 1.32,
    clicksAll: 232,
    linkClicks: 114,
    ctrAll: 4.0,
    ctrLink: 1.97,
    cpm: 64.28,
    cpcAll: 1.61,
    cpcLink: 3.27,
    leads: 5,
    costPerLead: 74.5,
  },
];

function formatIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function normalizeWeights(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map(value => value / total);
}

function allocateDecimalTotal(total: number, weights: number[]) {
  const rounded = weights.map(weight => Number((total * weight).toFixed(2)));
  const roundedTotal = rounded.reduce((sum, value) => sum + value, 0);
  const delta = Number((total - roundedTotal).toFixed(2));

  if (rounded.length > 0 && delta !== 0) {
    rounded[rounded.length - 1] = Number(
      (rounded[rounded.length - 1] + delta).toFixed(2)
    );
  }

  return rounded;
}

function allocateIntegerTotal(total: number, weights: number[]) {
  const raw = weights.map(weight => total * weight);
  const floors = raw.map(value => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);

  const ranked = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction);

  let cursor = 0;
  while (remainder > 0 && ranked.length > 0) {
    floors[ranked[cursor % ranked.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return floors;
}

function buildSnapshot(
  preset: string,
  label: string,
  isPartial: boolean,
  factor: number,
  since: Date,
  until: Date
): FetchedSnapshot {
  const campaigns = BASE_CAMPAIGNS.map((campaign, index) => {
    const variance = 0.92 + ((index % 5) * 0.03);
    const scaledSpend = campaign.amountSpent * factor * variance;
    const scaledLeads = Math.max(
      campaign.leads > 0 ? 1 : 0,
      Math.round(campaign.leads * factor * (1.05 - index * 0.015))
    );
    const scaledImpressions = Math.max(
      100,
      Math.round(campaign.impressions * factor * variance)
    );
    const scaledReach = Math.min(
      scaledImpressions,
      Math.max(50, Math.round(campaign.reach * factor * (0.96 + index * 0.01)))
    );
    const scaledClicksAll = Math.max(
      0,
      Math.round(campaign.clicksAll * factor * variance)
    );
    const scaledLinkClicks = Math.max(
      0,
      Math.round(campaign.linkClicks * factor * (0.95 + index * 0.015))
    );
    const cpm = scaledImpressions > 0 ? (scaledSpend / scaledImpressions) * 1000 : campaign.cpm;
    const cpcAll = scaledClicksAll > 0 ? scaledSpend / scaledClicksAll : campaign.cpcAll;
    const cpcLink =
      scaledLinkClicks > 0 ? scaledSpend / scaledLinkClicks : campaign.cpcLink;
    const ctrAll =
      scaledImpressions > 0 ? (scaledClicksAll / scaledImpressions) * 100 : campaign.ctrAll;
    const ctrLink =
      scaledImpressions > 0 ? (scaledLinkClicks / scaledImpressions) * 100 : campaign.ctrLink;
    const costPerLead =
      scaledLeads > 0 ? scaledSpend / scaledLeads : null;

    return {
      ...campaign,
      amountSpent: Number(scaledSpend.toFixed(2)),
      impressions: scaledImpressions,
      reach: scaledReach,
      frequency:
        scaledReach > 0 ? Number((scaledImpressions / scaledReach).toFixed(2)) : campaign.frequency,
      clicksAll: scaledClicksAll,
      linkClicks: scaledLinkClicks,
      ctrAll: Number(ctrAll.toFixed(2)),
      ctrLink: Number(ctrLink.toFixed(2)),
      cpm: Number(cpm.toFixed(2)),
      cpcAll: Number(cpcAll.toFixed(4)),
      cpcLink: Number(cpcLink.toFixed(4)),
      leads: scaledLeads,
      costPerLead: costPerLead != null ? Number(costPerLead.toFixed(2)) : null,
    };
  });

  const account = campaigns.reduce(
    (totals, campaign) => {
      totals.amountSpent += campaign.amountSpent;
      totals.impressions += campaign.impressions;
      totals.reach += campaign.reach;
      totals.clicksAll += campaign.clicksAll;
      totals.linkClicks += campaign.linkClicks;
      totals.leads += campaign.leads;
      return totals;
    },
    {
      amountSpent: 0,
      impressions: 0,
      reach: 0,
      clicksAll: 0,
      linkClicks: 0,
      leads: 0,
    }
  );

  const frequency =
    account.reach > 0 ? Number((account.impressions / account.reach).toFixed(2)) : 0;
  const ctrAll =
    account.impressions > 0
      ? Number(((account.clicksAll / account.impressions) * 100).toFixed(2))
      : 0;
  const ctrLink =
    account.impressions > 0
      ? Number(((account.linkClicks / account.impressions) * 100).toFixed(2))
      : 0;
  const cpm =
    account.impressions > 0
      ? Number(((account.amountSpent / account.impressions) * 1000).toFixed(2))
      : 0;
  const cpcAll =
    account.clicksAll > 0
      ? Number((account.amountSpent / account.clicksAll).toFixed(4))
      : 0;
  const cpcLink =
    account.linkClicks > 0
      ? Number((account.amountSpent / account.linkClicks).toFixed(4))
      : 0;
  const costPerLead =
    account.leads > 0
      ? Number((account.amountSpent / account.leads).toFixed(2))
      : 0;

  return {
    datePreset: preset,
    datePresetLabel: label,
    dateRangeSince: formatIso(since),
    dateRangeUntil: formatIso(until),
    isPartial,
    account: {
      amountSpent: Number(account.amountSpent.toFixed(2)),
      impressions: account.impressions,
      reach: account.reach,
      frequency,
      clicksAll: account.clicksAll,
      linkClicks: account.linkClicks,
      ctrAll,
      ctrLink,
      cpm,
      cpcAll,
      cpcLink,
      leads: account.leads,
      costPerLead,
    },
    campaigns,
  };
}

export function getDemoFetchedDataset(): {
  account: MetaAccountProfile;
  snapshots: FetchedSnapshot[];
  sourceMode: "demo";
} {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const last30Until = yesterday;
  const last30Since = subDays(last30Until, 29);
  const last7Until = yesterday;
  const last7Since = subDays(last7Until, 6);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  return {
    account: {
      id: "act_demo_77497873",
      name: "Legacy Empowerment Group",
      currency: "USD",
    },
    sourceMode: "demo",
    snapshots: [
      buildSnapshot("last_30d", "Last 30 Days", false, 1, last30Since, last30Until),
      buildSnapshot("last_7d", "Last 7 Days", false, 0.24, last7Since, last7Until),
      buildSnapshot(
        "this_week_mon_today",
        "This Week",
        true,
        0.17,
        weekStart,
        today
      ),
      buildSnapshot("today", "Today", true, 0.035, today, today),
      buildSnapshot("yesterday", "Yesterday", false, 0.04, yesterday, yesterday),
    ],
  };
}

export function getDemoDailyPerformance(): DailyPerformancePoint[] {
  const dataset = getDemoFetchedDataset();
  const last30Days =
    dataset.snapshots.find(snapshot => snapshot.datePreset === "last_30d") ??
    dataset.snapshots[0];

  if (!last30Days) {
    return [];
  }

  const dates = eachDayOfInterval({
    start: new Date(`${last30Days.dateRangeSince}T00:00:00Z`),
    end: new Date(`${last30Days.dateRangeUntil}T00:00:00Z`),
  });
  const spendWeights = normalizeWeights(
    dates.map((_, index) =>
      Math.max(
        0.35,
        1 +
          Math.sin(index / 3.1) * 0.18 +
          Math.cos(index / 5.4) * 0.12 +
          ((index % 4) - 1.5) * 0.03
      )
    )
  );
  const leadWeights = normalizeWeights(
    spendWeights.map((weight, index) =>
      Math.max(0.2, weight * (0.94 + (index % 3) * 0.04))
    )
  );
  const spendByDay = allocateDecimalTotal(
    last30Days.account.amountSpent,
    spendWeights
  );
  const leadsByDay = allocateIntegerTotal(last30Days.account.leads, leadWeights);

  return dates.map((date, index) => {
    const amountSpent = spendByDay[index] ?? 0;
    const leads = leadsByDay[index] ?? 0;

    return {
      date: formatIso(date),
      label: format(date, "MMM d"),
      amountSpent,
      leads,
      costPerLead:
        leads > 0 ? Number((amountSpent / leads).toFixed(2)) : null,
    };
  });
}
