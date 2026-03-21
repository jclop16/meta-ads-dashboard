import { describe, expect, it } from "vitest";
import {
  buildRecommendationItems,
  evaluatePerformance,
  parseCampaignIdentity,
} from "./reportingAnalysis";

describe("parseCampaignIdentity", () => {
  it("extracts the 4-part naming convention and builds displayName", () => {
    const parsed = parseCampaignIdentity(
      "DS | FEGLI Trap | Feb 2026 | Government Employees"
    );

    expect(parsed.editorCode).toBe("DS");
    expect(parsed.campaignDescriptor).toBe("FEGLI Trap");
    expect(parsed.launchLabel).toBe("Feb 2026");
    expect(parsed.audienceDescriptor).toBe("Government Employees");
    expect(parsed.displayName).toBe("DS | FEGLI Trap");
  });

  it("falls back cleanly when the name does not match the convention", () => {
    const parsed = parseCampaignIdentity("Annuity Broad Prospecting");

    expect(parsed.editorCode).toBeNull();
    expect(parsed.campaignDescriptor).toBeNull();
    expect(parsed.displayName).toBe("Annuity Broad Prospecting");
  });
});

describe("evaluatePerformance", () => {
  it("scores high-performing rows as excellent", () => {
    const evaluation = evaluatePerformance({
      amountSpent: 1200,
      leads: 28,
      ctrLink: 2.1,
      frequency: 1.8,
      costPerLead: 18,
      priorCostPerLead: 19,
      cplTarget: 22.43,
    });

    expect(evaluation.performanceScore).toBeGreaterThanOrEqual(75);
    expect(evaluation.performanceStatus).toBe("excellent");
  });

  it("forces spend-without-leads rows to poor", () => {
    const evaluation = evaluatePerformance({
      amountSpent: 60,
      leads: 0,
      ctrLink: 1.5,
      frequency: 1.2,
      costPerLead: null,
      priorCostPerLead: null,
      cplTarget: 22.43,
    });

    expect(evaluation.performanceStatus).toBe("poor");
  });
});

describe("buildRecommendationItems", () => {
  it("generates deterministic recommendation drafts from signals", () => {
    const items = buildRecommendationItems([
      {
        entityLevel: "campaign",
        entityId: "cmp_1",
        displayName: "DS | FEGLI Trap",
        editorCode: "DS",
        launchLabel: "Feb 2026",
        audienceDescriptor: "Government Employees",
        amountSpent: 400,
        leads: 0,
        ctrLink: 0.85,
        frequency: 3.2,
        costPerLead: null,
        priorCostPerLead: null,
        cplDeltaPct: null,
        performanceScore: 18,
        performanceStatus: "poor",
        cplTarget: 22.43,
      },
    ]);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].headline).toContain("DS | FEGLI Trap");
    expect(items[0].status).toBe("open");
  });
});
