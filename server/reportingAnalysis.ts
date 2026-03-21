export type PerformanceStatus = "excellent" | "moderate" | "poor";

export type ParsedCampaignIdentity = {
  rawName: string;
  shortName: string;
  displayName: string;
  editorCode: string | null;
  campaignDescriptor: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
};

export type PerformanceEvaluationInput = {
  amountSpent: number;
  leads: number;
  ctrLink: number;
  frequency: number;
  costPerLead: number | null;
  priorCostPerLead: number | null;
  cplTarget: number;
};

export type PerformanceEvaluation = {
  performanceScore: number;
  performanceStatus: PerformanceStatus;
  cplDeltaPct: number | null;
};

export type RecommendationSignal = {
  entityLevel: "campaign" | "adset";
  entityId: string;
  displayName: string;
  editorCode: string | null;
  launchLabel: string | null;
  audienceDescriptor: string | null;
  amountSpent: number;
  leads: number;
  ctrLink: number;
  frequency: number;
  costPerLead: number | null;
  priorCostPerLead: number | null;
  cplDeltaPct: number | null;
  performanceScore: number;
  performanceStatus: PerformanceStatus;
  cplTarget: number;
};

export type RecommendationItemDraft = {
  entityLevel: "campaign" | "adset";
  entityId: string;
  actionType: "pause" | "scale" | "optimize" | "test";
  headline: string;
  rationale: string;
  confidenceScore: number;
  expectedImpact: string;
  riskNote: string;
  status: "open";
  priority: "critical" | "high" | "medium";
  category: "pause" | "scale" | "optimize" | "test";
};

function cleanNameSegment(value: string | null | undefined) {
  const cleaned = value?.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

export function toShortName(name: string) {
  return (
    cleanNameSegment(name)?.slice(0, 60) ??
    name.replace(/\s+/g, " ").trim().slice(0, 60)
  );
}

export function parseCampaignIdentity(name: string): ParsedCampaignIdentity {
  const rawName = name;
  const segments = name.split("|").map(segment => cleanNameSegment(segment));
  const hasStructuredSegments = segments.filter(Boolean).length >= 2;
  const editorCode = hasStructuredSegments ? segments[0] ?? null : null;
  const campaignDescriptor = hasStructuredSegments ? segments[1] ?? null : null;
  const launchLabel = hasStructuredSegments ? segments[2] ?? null : null;
  const audienceDescriptor = hasStructuredSegments ? segments[3] ?? null : null;
  const displayName =
    editorCode && campaignDescriptor
      ? `${editorCode} | ${campaignDescriptor}`
      : campaignDescriptor ?? editorCode ?? toShortName(name);

  return {
    rawName,
    shortName: toShortName(campaignDescriptor ?? editorCode ?? rawName),
    displayName,
    editorCode,
    campaignDescriptor,
    launchLabel,
    audienceDescriptor,
  };
}

export function computePercentDelta(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function scoreCpl(costPerLead: number | null, cplTarget: number) {
  if (costPerLead == null) return 20;
  if (costPerLead <= cplTarget) return 50;
  if (costPerLead <= cplTarget * 1.25) return 35;
  if (costPerLead <= cplTarget * 1.5) return 20;
  return 0;
}

function scoreLeadVolume(leads: number) {
  if (leads >= 15) return 15;
  if (leads >= 5) return 8;
  if (leads >= 1) return 4;
  return 0;
}

function scoreCtr(ctrLink: number) {
  if (ctrLink >= 1.75) return 15;
  if (ctrLink >= 1.25) return 10;
  if (ctrLink >= 0.9) return 5;
  return 0;
}

function scoreFrequency(frequency: number) {
  if (frequency <= 2.0) return 10;
  if (frequency <= 2.8) return 6;
  if (frequency <= 3.5) return 2;
  return 0;
}

function scoreTrend(costPerLead: number | null, priorCostPerLead: number | null) {
  if (costPerLead == null || priorCostPerLead == null || priorCostPerLead <= 0) {
    return { score: 5, deltaPct: null };
  }

  const deltaPct = computePercentDelta(costPerLead, priorCostPerLead);
  if (deltaPct == null) {
    return { score: 5, deltaPct: null };
  }
  if (deltaPct <= 0) {
    return { score: 10, deltaPct };
  }
  if (deltaPct <= 15) {
    return { score: 5, deltaPct };
  }
  return { score: 0, deltaPct };
}

export function evaluatePerformance(
  input: PerformanceEvaluationInput
): PerformanceEvaluation {
  const cpl = scoreCpl(input.costPerLead, input.cplTarget);
  const volume = scoreLeadVolume(input.leads);
  const ctr = scoreCtr(input.ctrLink);
  const frequency = scoreFrequency(input.frequency);
  const trend = scoreTrend(input.costPerLead, input.priorCostPerLead);
  const performanceScore = cpl + volume + ctr + frequency + trend.score;

  let performanceStatus: PerformanceStatus;
  if (performanceScore >= 75 && input.leads >= 5) {
    performanceStatus = "excellent";
  } else if (performanceScore >= 45 || (performanceScore >= 75 && input.leads < 5)) {
    performanceStatus = "moderate";
  } else {
    performanceStatus = "poor";
  }

  if (input.amountSpent >= input.cplTarget * 2 && input.leads === 0) {
    performanceStatus = "poor";
  }

  return {
    performanceScore,
    performanceStatus,
    cplDeltaPct: trend.deltaPct,
  };
}

function scoreToConfidence(score: number) {
  return Number(Math.min(0.98, Math.max(0.5, 0.5 + score / 200)).toFixed(2));
}

function makeRecommendation(
  signal: RecommendationSignal,
  input: {
    actionType: RecommendationItemDraft["actionType"];
    headline: string;
    rationale: string;
    expectedImpact: string;
    riskNote: string;
    priority: RecommendationItemDraft["priority"];
  }
): RecommendationItemDraft {
  return {
    entityLevel: signal.entityLevel,
    entityId: signal.entityId,
    actionType: input.actionType,
    headline: input.headline,
    rationale: input.rationale,
    confidenceScore: scoreToConfidence(signal.performanceScore),
    expectedImpact: input.expectedImpact,
    riskNote: input.riskNote,
    status: "open",
    priority: input.priority,
    category: input.actionType,
  };
}

function buildSignalRecommendations(signal: RecommendationSignal) {
  const items: RecommendationItemDraft[] = [];

  if (signal.amountSpent >= signal.cplTarget * 2 && signal.leads === 0) {
    items.push(
      makeRecommendation(signal, {
        actionType: "pause",
        headline: `Reduce spend on ${signal.displayName}`,
        rationale: `${signal.displayName} has spent ${signal.amountSpent.toFixed(2)} without producing a lead in the selected range. Delivery is proving cost without conversion signal.`,
        expectedImpact: "Protect budget until a stronger creative, audience, or landing-page test is ready.",
        riskNote: "Pulling back too fast can reduce learning continuity if the campaign is new or still volume constrained.",
        priority: "critical",
      })
    );
  }

  if (signal.performanceStatus === "excellent" && signal.leads >= 15) {
    items.push(
      makeRecommendation(signal, {
        actionType: "scale",
        headline: `Scale ${signal.displayName}`,
        rationale: `${signal.displayName} is outperforming target with ${signal.leads} leads and a performance score of ${signal.performanceScore}.`,
        expectedImpact: "Increase lead volume while holding blended CPL near current levels.",
        riskNote: "Scaling too quickly can raise costs or reduce lead quality once frequency starts climbing.",
        priority: "high",
      })
    );
  }

  if (signal.ctrLink < 1.25 && signal.amountSpent >= signal.cplTarget) {
    items.push(
      makeRecommendation(signal, {
        actionType: "test",
        headline: `Refresh the hook for ${signal.displayName}`,
        rationale: `${signal.displayName} is only driving ${signal.ctrLink.toFixed(2)}% link CTR. The click signal is too soft for sustainable cost control.`,
        expectedImpact: "Lift click-through rate and reduce wasted spend before conversion costs drift further.",
        riskNote: "A stronger hook can improve CTR but sometimes pulls broader, lower-intent traffic if the landing page stays unchanged.",
        priority: "medium",
      })
    );
  }

  if (signal.frequency > 2.8) {
    items.push(
      makeRecommendation(signal, {
        actionType: "optimize",
        headline: `Address fatigue in ${signal.displayName}`,
        rationale: `${signal.displayName} is running at ${signal.frequency.toFixed(2)} frequency, which suggests the audience or creative is saturating.`,
        expectedImpact: "Stabilize CPL by rotating creative, widening the audience, or resetting the offer angle.",
        riskNote: "Broadening targeting can lower costs while also loosening fit if audience intent is not monitored.",
        priority: "medium",
      })
    );
  }

  if ((signal.cplDeltaPct ?? 0) > 15) {
    items.push(
      makeRecommendation(signal, {
        actionType: "optimize",
        headline: `Correct the CPL slide in ${signal.displayName}`,
        rationale: `${signal.displayName} is now ${signal.cplDeltaPct?.toFixed(1)}% worse on CPL versus the prior period.`,
        expectedImpact: "Recover efficiency before rising costs distort the blended account picture.",
        riskNote: "Aggressive fixes can cut spend quickly, but they can also hide whether the issue is fatigue, targeting, or landing-page friction.",
        priority: "high",
      })
    );
  }

  if (signal.performanceStatus === "poor" && signal.costPerLead != null && signal.costPerLead > signal.cplTarget * 1.5) {
    items.push(
      makeRecommendation(signal, {
        actionType: signal.ctrLink < 1 ? "pause" : "optimize",
        headline: `Rework ${signal.displayName}`,
        rationale: `${signal.displayName} is well over target at ${signal.costPerLead.toFixed(2)} CPL with a performance score of ${signal.performanceScore}.`,
        expectedImpact: "Reduce budget waste and reallocate toward stronger campaigns while a replacement test is prepared.",
        riskNote: "Cost-focused intervention may improve efficiency but can reduce lead volume if this campaign is still supplying qualified traffic.",
        priority: "high",
      })
    );
  }

  return items;
}

export function buildRecommendationItems(signals: RecommendationSignal[]) {
  const deduped = new Map<string, RecommendationItemDraft>();

  signals
    .flatMap(buildSignalRecommendations)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .forEach(item => {
      const key = `${item.entityLevel}:${item.entityId}:${item.headline}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

  return Array.from(deduped.values()).slice(0, 8);
}
