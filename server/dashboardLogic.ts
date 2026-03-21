import { format, parseISO } from "date-fns";
import type { FetchedSnapshot, MetaAccountProfile } from "./metaAdsFetcher";

export const DEFAULT_CPL_TARGET = 22.43;

export type PerformanceStatus = "excellent" | "moderate" | "poor";

export type ActionItemDraft = {
  priority: "critical" | "high" | "medium";
  category: "pause" | "scale" | "optimize" | "test";
  title: string;
  description: string;
  estimatedImpact: string;
  completed: boolean;
};

type CurrentCampaignRow = {
  id: string;
  name: string;
  shortName: string;
  objective: "FEGLI Trap" | "Annuity" | "FEGLI Conversion" | "Other";
  amountSpent: string;
  impressions: number;
  reach: number;
  frequency: string;
  clicksAll: number;
  linkClicks: number;
  ctrAll: string;
  ctrLink: string;
  cpm: string;
  cpcAll: string;
  cpcLink: string;
  leads: number;
  costPerLead: string | null;
  status: PerformanceStatus;
  recommendation: string;
};

export type ActionSignalRow = {
  shortName: string;
  amountSpent: string | number;
  ctrLink: string | number;
  frequency: string | number;
  costPerLead: string | number | null;
  status: PerformanceStatus;
};

type RecommendationMetrics = {
  shortName: string;
  amountSpent: number;
  leads: number;
  linkClicks: number;
  ctrLink: number;
  frequency: number;
  costPerLead: number | null;
};

function toFixedString(value: number, digits: number) {
  return value.toFixed(digits);
}

export function formatReportDateRange(since: string, until: string) {
  const start = parseISO(since);
  const end = parseISO(until);

  if (since === until) {
    return format(start, "MMM d, yyyy");
  }

  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function normalizeObjective(
  objective: string
): "FEGLI Trap" | "Annuity" | "FEGLI Conversion" | "Other" {
  if (objective === "FEGLI Trap") return objective;
  if (objective === "Annuity") return objective;
  if (objective === "FEGLI Conversion") return objective;
  return "Other";
}

export function getCampaignStatus(
  costPerLead: number | null,
  cplTarget: number
): PerformanceStatus {
  if (costPerLead == null) return "moderate";
  if (costPerLead <= cplTarget) return "excellent";
  if (costPerLead <= cplTarget * 1.5) return "moderate";
  return "poor";
}

export function buildCampaignRecommendation(
  campaign: RecommendationMetrics,
  cplTarget: number
) {
  const status = getCampaignStatus(campaign.costPerLead, cplTarget);
  const ctrLink = campaign.ctrLink;
  const cpl = campaign.costPerLead;

  if (campaign.leads === 0 && campaign.amountSpent > cplTarget * 2) {
    return "No lead signal yet. Pause budget or narrow the audience until the ad generates a first conversion.";
  }

  if (status === "excellent") {
    if (campaign.linkClicks >= 100 && campaign.leads >= 20) {
      return "Scale in 10-15% budget steps and preserve the current creative/audience mix while monitoring CPL stability.";
    }

    return "Keep this campaign active and use it as the benchmark for new creative or audience tests.";
  }

  if (status === "moderate") {
    if (ctrLink < 1.5) {
      return "Click-through efficiency is soft. Refresh the hook and primary text before adding more budget.";
    }

    if (campaign.frequency > 2.5) {
      return "Frequency is rising. Rotate creative or broaden targeting before delivery fatigue pushes CPL higher.";
    }

    return "Maintain limited spend and test one variable at a time to bring CPL back toward target.";
  }

  if (ctrLink < 1.0) {
    return "Pause or heavily reduce spend. The ad is too expensive and link engagement is not strong enough to justify budget.";
  }

  if (campaign.frequency > 2.5) {
    return "Cost is over target and the audience is saturating. Refresh creative or audience before resuming scale.";
  }

  return "Reallocate spend toward lower-CPL campaigns and restart only after a creative, audience, or landing-page change.";
}

export function buildCurrentAccountMetricsRow(
  account: MetaAccountProfile,
  snapshot: FetchedSnapshot
) {
  return {
    reportDateRange: formatReportDateRange(
      snapshot.dateRangeSince,
      snapshot.dateRangeUntil
    ),
    accountName: account.name,
    accountCurrency: account.currency,
    amountSpent: toFixedString(snapshot.account.amountSpent, 2),
    impressions: snapshot.account.impressions,
    reach: snapshot.account.reach,
    frequency: toFixedString(snapshot.account.frequency, 2),
    clicksAll: snapshot.account.clicksAll,
    linkClicks: snapshot.account.linkClicks,
    ctrAll: toFixedString(snapshot.account.ctrAll, 2),
    ctrLink: toFixedString(snapshot.account.ctrLink, 2),
    cpm: toFixedString(snapshot.account.cpm, 2),
    cpcAll: toFixedString(snapshot.account.cpcAll, 4),
    cpcLink: toFixedString(snapshot.account.cpcLink, 4),
    leads: snapshot.account.leads,
    costPerLead: toFixedString(snapshot.account.costPerLead, 2),
  };
}

export function buildCurrentCampaignRows(
  snapshot: FetchedSnapshot,
  cplTarget: number
): CurrentCampaignRow[] {
  return snapshot.campaigns.map(campaign => {
    const status = getCampaignStatus(campaign.costPerLead, cplTarget);

    return {
      id: campaign.campaignId,
      name: campaign.campaignName,
      shortName: campaign.shortName,
      objective: normalizeObjective(campaign.objective),
      amountSpent: toFixedString(campaign.amountSpent, 2),
      impressions: campaign.impressions,
      reach: campaign.reach,
      frequency: toFixedString(campaign.frequency, 2),
      clicksAll: campaign.clicksAll,
      linkClicks: campaign.linkClicks,
      ctrAll: toFixedString(campaign.ctrAll, 2),
      ctrLink: toFixedString(campaign.ctrLink, 2),
      cpm: toFixedString(campaign.cpm, 2),
      cpcAll: toFixedString(campaign.cpcAll, 4),
      cpcLink: toFixedString(campaign.cpcLink, 4),
      leads: campaign.leads,
      costPerLead:
        campaign.costPerLead != null
          ? toFixedString(campaign.costPerLead, 2)
          : null,
      status,
      recommendation: buildCampaignRecommendation(campaign, cplTarget),
    };
  });
}

export function buildActionItems(
  campaigns: CurrentCampaignRow[],
  cplTarget: number,
  completedByTitle = new Map<string, boolean>(),
  adsets: ActionSignalRow[] = []
): ActionItemDraft[] {
  const items: ActionItemDraft[] = [];
  const sortedBySpend = [...campaigns].sort(
    (left, right) => Number(right.amountSpent) - Number(left.amountSpent)
  );
  const poor = sortedBySpend.filter(c => c.status === "poor");
  const excellent = [...campaigns]
    .filter(c => c.status === "excellent")
    .sort((left, right) => Number(left.costPerLead ?? "9999") - Number(right.costPerLead ?? "9999"));
  const lowCtr = sortedBySpend.filter(c => Number(c.ctrLink) < 1.5);
  const highFrequency = sortedBySpend.filter(c => Number(c.frequency) >= 2.5);
  const poorAdsets = [...adsets]
    .filter(adset => adset.status === "poor")
    .sort(
      (left, right) => Number(right.amountSpent) - Number(left.amountSpent)
    );
  const lowCtrAdsets = [...adsets]
    .filter(adset => Number(adset.ctrLink) < 1.25)
    .sort(
      (left, right) => Number(right.amountSpent) - Number(left.amountSpent)
    );

  if (poor[0]) {
    const campaign = poor[0];
    const currentCpl = Number(campaign.costPerLead ?? "0");
    items.push({
      priority: "critical",
      category: "pause",
      title: `Reduce spend on ${campaign.shortName}`,
      description: `${campaign.shortName} is running at $${currentCpl.toFixed(2)} CPL, well above your $${cplTarget.toFixed(2)} target. Shift budget away until a new angle or audience is ready.`,
      estimatedImpact: `Protect ~$${Number(campaign.amountSpent).toLocaleString("en-US", { maximumFractionDigits: 0 })} in monthly spend`,
      completed: completedByTitle.get(`Reduce spend on ${campaign.shortName}`) ?? false,
    });
  }

  if (excellent[0]) {
    const campaign = excellent[0];
    const currentCpl = Number(campaign.costPerLead ?? "0");
    items.push({
      priority: "high",
      category: "scale",
      title: `Scale ${campaign.shortName}`,
      description: `${campaign.shortName} is beating target at $${currentCpl.toFixed(2)} CPL. Increase budget gradually and keep creative stable while it holds efficiency.`,
      estimatedImpact: "Increase lead volume without raising blended CPL",
      completed: completedByTitle.get(`Scale ${campaign.shortName}`) ?? false,
    });
  }

  if (lowCtr[0]) {
    const campaign = lowCtr[0];
    items.push({
      priority: "medium",
      category: "test",
      title: `Refresh creative for ${campaign.shortName}`,
      description: `${campaign.shortName} is only driving ${Number(campaign.ctrLink).toFixed(2)}% link CTR. Test a new hook, headline, or opening frame to improve click quality.`,
      estimatedImpact: "Lift CTR and improve downstream CPL",
      completed: completedByTitle.get(`Refresh creative for ${campaign.shortName}`) ?? false,
    });
  }

  if (highFrequency[0]) {
    const campaign = highFrequency[0];
    items.push({
      priority: "medium",
      category: "optimize",
      title: `Watch delivery fatigue on ${campaign.shortName}`,
      description: `${campaign.shortName} is already at ${Number(campaign.frequency).toFixed(2)} frequency. Broaden audience or rotate assets before performance degrades further.`,
      estimatedImpact: "Reduce fatigue-driven CPL inflation",
      completed:
        completedByTitle.get(`Watch delivery fatigue on ${campaign.shortName}`) ??
        false,
    });
  }

  if (poorAdsets[0]) {
    const adset = poorAdsets[0];
    const currentCpl = Number(adset.costPerLead ?? "0");
    items.push({
      priority: "medium",
      category: "optimize",
      title: `Tighten ${adset.shortName}`,
      description: `${adset.shortName} is over target at $${currentCpl.toFixed(2)} CPL. Narrow placements, audience, or optimization inputs before adding more spend.`,
      estimatedImpact: "Reduce wasted spend inside the campaign before broader budget changes",
      completed: completedByTitle.get(`Tighten ${adset.shortName}`) ?? false,
    });
  }

  if (lowCtrAdsets[0]) {
    const adset = lowCtrAdsets[0];
    items.push({
      priority: "medium",
      category: "test",
      title: `Test a new angle in ${adset.shortName}`,
      description: `${adset.shortName} is under 1.25% link CTR. Test a sharper hook or creative angle before scaling the parent campaign.`,
      estimatedImpact: "Improve click quality at the ad set level",
      completed:
        completedByTitle.get(`Test a new angle in ${adset.shortName}`) ?? false,
    });
  }

  return items.slice(0, 4);
}
